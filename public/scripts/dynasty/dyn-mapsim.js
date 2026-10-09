/* Burger Town Leagues — DYNASTY: visual map simulation (Raid, Checkmate, Garrison, Moscow, Apocalypse: Hardpoint;
   Raid, Moscow, Miami, Express: Search and Destroy; Raid, Checkmate, Garrison: Control).
   Eight agents play the mode on a top-down grid traced from the Raid overhead map, with real walls and doorways
   (doors placed where players walked through them in AJ's walkthrough and match footage). Every kill, death,
   second on the hill, plant, defuse and capture in the box score comes from what happens on the map.
   Each agent's decisions (who sits on the hill, who anchors, when to rotate, when to break, who flanks, which
   route they take, how fast they react) come from the player's profile.
   No DOM here: it runs in the browser and in Node, and it uses its own seeded rng so a replay re-runs exactly. */
(function(root){
"use strict";
var DY = root.DY = root.DY || {};
var MS = DY.MS = {};
MS.VERSION = 3;
MS.MAPS = {};   // filled by dyn-mapdata.js

/* tuning (map px: the Raid map is ~280 px wide; a player runs ~18 px/s) */
MS.FOV = 1.15; MS.MEM = 3; MS.SPB = 85; MS.FALL = 0.8; MS.FALL_HP = 112; MS.FALL_R = 14; MS.HIT = 0.18; MS.SKILL = 140; MS.RANGE = 75; MS.DT = 0.1; MS.MAXHP = 150; MS.DMG = 38; MS.SPD = 18;
MS.HP = {HILL_SEC:60, TARGET:250, LIMIT:720, RESPAWN:2.5, SCRAP:15};
MS.SND = {ROUND:90, PLANT:5, DEFUSE:7.5, BOMB:40, WIN:6, GAP:3};
MS.CTL = {ROUND:90, LIVES:30, WIN:3, RESPAWN:3, CAP:10, GAP:3, OT:15, FALL:0.15, BONUS:30};

/* ---------------- rng ---------------- */
function mul(seed){ var s = seed | 0; return function(){ s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var clamp = function(x, a, b){ return Math.max(a, Math.min(b, x)); };
var angd = function(a){ while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/* ---------------- map prep (cached per map) ----------------
   grid codes: 0 outside, 1 outdoor, 2 indoor, 3 low cover (blocks movement, not sight), 4 wall/solid (blocks both) */
var PREP = {};
function decode(rle, n){ var g = new Uint8Array(n), i = 0, re = /([A-G])([0-9a-z]+)/g, m; while ((m = re.exec(rle))){ var v = "ABCDEFG".indexOf(m[1]), k = parseInt(m[2], 36); for (var j = 0; j < k && i < n; j++) g[i++] = v; } return g; }
function mkP(name){
  var M = MS.MAPS[name], W = M.W, H = M.H, CS = M.cs, g = decode(M.rle, W * H);
  var P = {name:name, M:M, W:W, H:H, CS:CS, g:g, fields:{}, nodes:[], obj:{}, heap:null};
  P.cell = function(x, y){ var cx = Math.floor(x / CS), cy = Math.floor(y / CS); return cx < 0 || cy < 0 || cx >= W || cy >= H ? -1 : cy * W + cx; };
  var wk = new Uint8Array(W * H); for (var q = 0; q < W * H; q++) wk[q] = g[q] === 1 || g[q] === 2 || g[q] === 5 || g[q] === 6 ? 1 : 0; P.wk = wk;
  P.walkC = function(c){ return c >= 0 && wk[c] === 1; };
  P.walk = function(x, y){ return P.walkC(P.cell(x, y)); };
  P.cx = function(c){ return (c % W + 0.5) * CS; }; P.cy = function(c){ return (Math.floor(c / W) + 0.5) * CS; };
  // cost penalty next to walls so paths don't scrape along them
  var pen = new Uint8Array(W * H);
  for (var c = 0; c < W * H; c++){ if (!P.walkC(c)) continue; var x = c % W, y = (c / W) | 0, near = 0;
    for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++){ var nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || !P.walkC(ny * W + nx)){ var dd = Math.max(Math.abs(ox), Math.abs(oy)); near = Math.max(near, dd === 1 ? 6 : 2); } }
    pen[c] = near; }
  P.pen = pen;
  return P;
}
// grid traversal (every cell the segment touches); ok(v) says whether a cell code lets it through
function trav(P, x0, y0, x1, y1, see){
  var CS = P.CS, W = P.W, H = P.H, g = P.g, dx = x1 - x0, dy = y1 - y0;
  var cx = Math.floor(x0 / CS), cy = Math.floor(y0 / CS), ex = Math.floor(x1 / CS), ey = Math.floor(y1 / CS);
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, adx = Math.abs(dx), ady = Math.abs(dy);
  var tdx = adx > 1e-9 ? CS / adx : 1e9, tdy = ady > 1e-9 ? CS / ady : 1e9;
  var tmx = adx > 1e-9 ? (sx > 0 ? (cx + 1) * CS - x0 : x0 - cx * CS) / adx : 1e9, tmy = ady > 1e-9 ? (sy > 0 ? (cy + 1) * CS - y0 : y0 - cy * CS) / ady : 1e9;
  for (var n = 0; n < 2000; n++){
    if (cx === ex && cy === ey) return true;
    if (tmx < tmy){ tmx += tdx; cx += sx; } else { tmy += tdy; cy += sy; }
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return false;
    var v = g[cy * W + cx];
    if (see ? (v === 0 || v === 4 || v === 5) : (v !== 1 && v !== 2 && v !== 5 && v !== 6)) return false;
  }
  return true;
}
// line of sight: no wall/solid/outside cell between the two points
function los(P, x0, y0, x1, y1, range){ var dx = x1 - x0, dy = y1 - y0; if (dx * dx + dy * dy > range * range) return false; return trav(P, x0, y0, x1, y1, true); }
// straight walk with a little body width
function clear(P, x0, y0, x1, y1){
  var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / d * 0.6, ny = dx / d * 0.6;
  return trav(P, x0, y0, x1, y1, false) && trav(P, x0 + nx, y0 + ny, x1 + nx, y1 + ny, false) && trav(P, x0 - nx, y0 - ny, x1 - nx, y1 - ny, false);
}
MS.los = function(map, x0, y0, x1, y1, r){ return los(prep(map), x0, y0, x1, y1, r || 999); };
function nearestWalk(P, x, y){ var c = P.cell(x, y); if (P.walkC(c)) return c; var cx = Math.floor(x / P.CS), cy = Math.floor(y / P.CS);
  for (var r = 1; r < 30; r++) for (var a = -r; a <= r; a++) for (var b = -r; b <= r; b++){ if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; var nx = cx + a, ny = cy + b; if (nx < 0 || ny < 0 || nx >= P.W || ny >= P.H) continue; var k = ny * P.W + nx; if (P.walkC(k)) return k; } return c; }
function addNode(P, x, y){ var c = nearestWalk(P, x, y); P.nodes.push({c:c, x:P.cx(c), y:P.cy(c)}); return P.nodes.length - 1; }
// distance field (cost units: 10 per cell straight, 14 diagonal, + wall penalty) to a node; Int32, cached
function field(P, node, lim){
  if (P.fields[node]) return P.fields[node];
  var W = P.W, N = W * P.H, D = new Int32Array(N).fill(0x3fffffff), pen = P.pen, wk = P.wk, H = P.H, gg = P.g; lim = lim || 0x3ffffff0;
  if (!P.heap) P.heap = {k:new Int32Array(N * 4), v:new Int32Array(N * 4)};
  var hk = P.heap.k, hv = P.heap.v, hn = 0;
  var push = function(key, val){ var i = hn++; hk[i] = key; hv[i] = val; while (i > 0){ var p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; var tk = hk[p], tv = hv[p]; hk[p] = hk[i]; hv[p] = hv[i]; hk[i] = tk; hv[i] = tv; i = p; } };
  var s0 = P.nodes[node].c; D[s0] = 0; push(0, s0);
  while (hn){
    var d = hk[0], i = hv[0]; hn--; if (hn){ hk[0] = hk[hn]; hv[0] = hv[hn]; var k = 0; for (;;){ var l = 2 * k + 1, r = l + 1, s = k; if (l < hn && hk[l] < hk[s]) s = l; if (r < hn && hk[r] < hk[s]) s = r; if (s === k) break; var tk = hk[s], tv = hv[s]; hk[s] = hk[k]; hv[s] = hv[k]; hk[k] = tk; hv[k] = tv; k = s; } }
    if (d > D[i]) continue; if (d > lim) break; var cx = i % W, cy = (i / W) | 0;
    for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++){
      if (!ox && !oy) continue; var nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; var j = ny * W + nx; if (!wk[j]) continue;
      if (ox && oy && (!wk[cy * W + nx] || !wk[ny * W + cx])) continue;
      var nd = d + (ox && oy ? 14 : 10) + pen[j] + (gg[j] === 6 ? 30 : 0); if (nd < D[j] && hn < hk.length){ D[j] = nd; push(nd, j); }
    }
  }
  P.fields[node] = D; return D;
}
var CU = function(P){ return P.CS / 10; };   // cost units -> px (roughly)

// zone masks (circle or polygon) for hills, sites and control zones
function inPoly(pts, x, y){ var ins = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++){ var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
function mkZone(P, sh){
  var m = new Uint8Array(P.W * P.H), cells = [], sx = 0, sy = 0;
  for (var c = 0; c < m.length; c++){ if (!P.walkC(c)) continue; var x = P.cx(c), y = P.cy(c);
    var inside = sh.r ? Math.hypot(x - sh.x, y - sh.y) <= sh.r : inPoly(sh.pts, x, y);
    if (sh.hole && Math.hypot(x - sh.hole[0], y - sh.hole[1]) <= sh.hole[2]) inside = false;
    if (inside){ m[c] = 1; cells.push(c); sx += x; sy += y; } }
  var cx = cells.length ? sx / cells.length : sh.x, cy = cells.length ? sy / cells.length : sh.y;
  // radius that covers most of the zone (for spot generation and drawing)
  var rr = 0; cells.forEach(function(c){ rr = Math.max(rr, Math.hypot(P.cx(c) - cx, P.cy(c) - cy)); });
  return {mask:m, cells:cells, x:cx, y:cy, r:Math.max(4, rr), sh:sh};
}
// spots around an objective: walkable cells in a ring with sight of the zone, spread out
function mkSpots(P, Z, lo, hi, n){
  var samp = [], cands = [];
  for (var k = 0; k < 10; k++){ var c = Z.cells[Math.floor(k * Z.cells.length / 10)]; if (c != null) samp.push([P.cx(c), P.cy(c)]); }
  samp.push([Z.x, Z.y]);
  var W = P.W, r0 = Math.floor((Z.r + hi) / P.CS) + 1, ccx = Math.floor(Z.x / P.CS), ccy = Math.floor(Z.y / P.CS);
  for (var cy = ccy - r0; cy <= ccy + r0; cy++) for (var cx = ccx - r0; cx <= ccx + r0; cx++){
    if (cx < 0 || cy < 0 || cx >= W || cy >= P.H || (cx + cy) % 2) continue; var c = cy * W + cx; if (!P.walkC(c) || Z.mask[c] || P.pen[c] >= 6) continue;
    var x = P.cx(c), y = P.cy(c), d = Math.hypot(x - Z.x, y - Z.y) - Z.r * 0.6; if (d < lo || d > hi) continue;
    var sees = 0; samp.forEach(function(q){ if (los(P, x, y, q[0], q[1], 999)) sees++; }); if (!sees) continue;
    cands.push({x:x, y:y, d:Math.hypot(x - Z.x, y - Z.y), a:Math.atan2(y - Z.y, x - Z.x), sees:sees / samp.length});
  }
  var pick = [];
  if (cands.length){ cands.sort(function(a, b){ return b.sees - a.sees || a.d - b.d; }); pick.push(cands[0]); }
  while (pick.length < Math.min(n, cands.length)){
    var best = null, bd = -1; cands.forEach(function(c){ var md = 1e9; pick.forEach(function(q){ md = Math.min(md, Math.hypot(c.x - q.x, c.y - q.y)); }); var v = md * (0.6 + c.sees); if (v > bd){ bd = v; best = c; } });
    pick.push(best);
  }
  return pick.map(function(c){ return {node:addNode(P, c.x, c.y), x:c.x, y:c.y, d:c.d, a:c.a, sees:c.sees}; });
}
// staging spots: close to the objective but out of its sight (behind a wall or around a corner)
function mkHide(P, Z, lo, hi, n){
  var samp = []; for (var k = 0; k < 8; k++){ var c = Z.cells[Math.floor(k * Z.cells.length / 8)]; if (c != null) samp.push([P.cx(c), P.cy(c)]); } samp.push([Z.x, Z.y]);
  var W = P.W, r0 = Math.floor((Z.r + hi) / P.CS) + 1, ccx = Math.floor(Z.x / P.CS), ccy = Math.floor(Z.y / P.CS), cands = [];
  for (var cy = ccy - r0; cy <= ccy + r0; cy += 2) for (var cx = ccx - r0; cx <= ccx + r0; cx += 2){
    if (cx < 0 || cy < 0 || cx >= W || cy >= P.H) continue; var c = cy * W + cx; if (!P.walkC(c) || Z.mask[c] || P.pen[c] >= 6) continue;
    var x = P.cx(c), y = P.cy(c), d = Math.hypot(x - Z.x, y - Z.y) - Z.r * 0.6; if (d < lo || d > hi) continue;
    if (samp.some(function(q){ return los(P, x, y, q[0], q[1], 999); })) continue;
    cands.push({x:x, y:y, d:Math.hypot(x - Z.x, y - Z.y), a:Math.atan2(y - Z.y, x - Z.x)}); }
  var pick = []; if (cands.length){ cands.sort(function(a, b){ return a.d - b.d; }); pick.push(cands[0]); }
  while (pick.length < Math.min(n, cands.length)){ var best = null, bd = -1e9; cands.forEach(function(c){ var md = 1e9; pick.forEach(function(q){ md = Math.min(md, Math.hypot(c.x - q.x, c.y - q.y)); }); var v = md - c.d * 0.25; if (v > bd){ bd = v; best = c; } }); pick.push(best); }
  return pick.map(function(c){ return {node:addNode(P, c.x, c.y), x:c.x, y:c.y, d:c.d, a:c.a, kind:"hide"}; });
}
function mkObj(P, sh, extra){
  var Z = mkZone(P, sh);
  Z.node = addNode(P, Z.x, Z.y);
  // a few points inside the zone to stand on
  Z.inside = []; var step = Math.max(1, Math.floor(Z.cells.length / 9)); for (var i = Math.floor(step / 2); i < Z.cells.length && Z.inside.length < 9; i += step){ var c = Z.cells[i]; if (P.pen[c] < 6) Z.inside.push(addNode(P, P.cx(c), P.cy(c))); }
  if (!Z.inside.length) Z.inside.push(Z.node);
  Z.spots = mkSpots(P, Z, 6, 46, 16);
  Z.hide = mkHide(P, Z, 14, 60, 12);
  var tag = function(list, kind){ return (list || []).map(function(q, i){ return {node:addNode(P, q[0], q[1]), x:q[0], y:q[1], kind:kind, i:i, d:Math.hypot(q[0] - Z.x, q[1] - Z.y), a:Math.atan2(q[1] - Z.y, q[0] - Z.x)}; }); };
  Z.hold = tag(extra && extra.hold, "hold"); Z.brk = tag(extra && extra.brk, "brk");
  return Z;
}
function prep(name){
  if (PREP[name]) return PREP[name];
  var P = mkP(name), M = P.M;
  P.via = (M.via || []).map(function(q){ return addNode(P, q[0], q[1]); });
  P.spawnNode = {};
  var sn = function(q){ var k = Math.round(q[0]) + "," + Math.round(q[1]); if (P.spawnNode[k] == null) P.spawnNode[k] = addNode(P, q[0], q[1]); return P.spawnNode[k]; };
  P.sn = sn;
  if (M.HP){ P.hills = M.HP.hills.map(function(h, i){ var Z = mkObj(P, h.sh, h); Z.i = i; Z.c = h.c; Z.n = h.n; Z.sp = h.sp.map(function(s){ return {node:sn([s[0], s[1]]), x:s[0], y:s[1], pri:s[2]}; }); return Z; }); }
  if (M.SND){ P.sites = M.SND.sites.map(function(s){ var Z = mkObj(P, {x:s.x, y:s.y, r:s.r || 9}); Z.c = s.c; Z.n = s.n; Z.px = s.x; Z.py = s.y; return Z; }); }
  if (M.CTL){ P.zones = M.CTL.zones.map(function(z){ var Z = mkObj(P, z.sh, z); Z.c = z.c; Z.n = z.n; return Z; }); }
  ["HP", "SND", "CTL"].forEach(function(k){ var m = M[k]; if (!m) return; (m.start ? m.start[0].concat(m.start[1]) : []).concat(m.atk || [], m.def || []).forEach(sn); });
  // a fixed pool of temporary nodes (fall-back spots, a dropped bomb) so the field cache stays bounded
  P.tmpBase = P.nodes.length; for (var k = 0; k < 40; k++) P.nodes.push({c:0, x:0, y:0, tmp:true, used:false});
  PREP[name] = P; return P;
}
MS.prep = prep; MS.field = field;
MS.modes = function(map){ var M = MS.MAPS[map]; if (!M) return []; return ["HP", "SND", "CTL"].filter(function(k){ return !!M[k]; }); };
MS.has = function(map, mode){ var M = MS.MAPS[map]; return !!(M && M[mode]); };

/* =====================================================================================
   THE MATCH
   input: {map, mode:"HP"|"SND"|"CTL", seed, edge:[ea, eb], ps:[8 players: {r:"AR"|"SMG", gs, ob, hs, en, cl, ni}]}
   players 0-3 = team A, 4-7 = team B. opts.rec: record frames for the viewer
   ===================================================================================== */
MS.run = function(inp, opts){
  opts = opts || {};
  var mode = inp.mode || "HP", P = prep(inp.map || "Raid"), M = P.M, rnd = mul(inp.seed || 1), DT = MS.DT;
  var gauss = function(){ var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  var cu = CU(P), SPB = M.spb || MS.SPB;
  var A = inp.ps.map(function(p, i){
    var tm = i < 4 ? 0 : 1, smg = p.r === "SMG";
    return {i:i, tm:tm, p:p, smg:smg, x:0, y:0, f:0, hp:MS.MAXHP, alive:false, resp:0, lastHit:-9, tgt:-1, react:0, still:0, goal:-1, via:-1, wp:null, wpT:0, mode:"x", k:0, d:0, ot:0, o1:0, o2:0, o3:0, fd:0, streak:0, best:0, multi:[], fire:-1, look:0, atk:-1, dec:rnd() * 0.5, wait:0, spot:null, lastFire:-9,
      rot:clamp(23 + (p.hs - 78) * 0.35 + (smg ? -2 : 3) + (rnd() - 0.5) * 8, 12, 36),
      flank:clamp((p.en - 40) / 60, 0, 0.9) * (smg ? 1 : 0.4),
      push:clamp((p.en - 45) / 90, 0, 0.45) * (smg ? 1 : 0.6),
      obj:(p.ob - 75) / 10 + (smg ? 0.6 : 0),
      hk:[0, 0, 0, 0, 0]};
  });
  var team = [0, 1].map(function(k){ return {k:k, sc:0, acc:0, ex:inp.edge ? inp.edge[k] : 1, holders:[], brk:null, seen:{}, side:null, lives:0}; });
  var t = 0, kills = [], frames = [], rec = !!opts.rec, frameEvery = 0.2, nextFrame = 0, log = [], R = null;
  var aliveOf = function(tm){ return A.filter(function(b){ return b.tm === tm && b.alive; }); };
  var enemies = function(a){ return A.filter(function(b){ return b.tm !== a.tm && b.alive; }); };
  var mates = function(a){ return A.filter(function(b){ return b.tm === a.tm && b.alive && b !== a; }); };
  var dist = function(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); };
  var centroid = function(list, fb){ if (!list.length) return fb; var x = 0, y = 0; list.forEach(function(b){ x += b.x; y += b.y; }); return {x:x / list.length, y:y / list.length}; };
  var pathD = function(a, node){ var c = P.cell(a.x, a.y); if (c < 0) return 1e9; var v = field(P, node, P.nodes[node].lim)[c]; return v >= 0x3fffffff ? Math.hypot(a.x - P.nodes[node].x, a.y - P.nodes[node].y) * 1.6 : v * cu; };
  // enemies this team knows about: seen in the last 3 s (last known spot)
  var known = function(tm){ var T = team[tm], out = []; A.forEach(function(e){ if (e.tm === tm) return; var s = T.seen[e.i]; if (s && t - s.t < MS.MEM && e.alive) out.push({x:s.x, y:s.y, i:e.i}); }); return out; };
  var spawnAt = function(a, node, face){ var nd = P.nodes[node]; a.x = nd.x + (rnd() - 0.5) * 2; a.y = nd.y + (rnd() - 0.5) * 2; if (!P.walk(a.x, a.y)){ a.x = nd.x; a.y = nd.y; } a.alive = true; a.hp = MS.MAXHP; a.tgt = -1; a.atk = -1; a.fire = -1;
    a.f = a.look = face ? Math.atan2(face.y - a.y, face.x - a.x) : 0; a.goal = -1; a.via = -1; a.wp = null; a.mode = "x"; a.dec = 0; a.still = 0; a.wait = 0; a.lastHit = -9; a.spot = null; a.spawnT = t; };

  /* ---------- movement: follow the distance field, string-pulled, with an optional via point for route variety ---------- */
  var setGoal = function(a, node, opt){
    if (node == null || node < 0) return;
    if (a.goal === node && !(opt && opt.force)) return;
    a.goal = node; a.via = -1; a.wp = null;
    var d0 = pathD(a, node);
    if (d0 < 45 || !P.via.length || P.nodes[node].lim) return;
    var want = opt && opt.flank ? 1 : opt && opt.direct ? 0 : 0.45 + (a.smg ? 0.1 : 0);
    if (rnd() > want + 0.15) return;
    var c = P.cell(a.x, a.y), G = field(P, node), gx = P.nodes[node].x, gy = P.nodes[node].y, best = -1, bv = -1e9;
    P.via.forEach(function(v){
      var V = P.nodes[v], dv = field(P, v)[c] * cu, dvg = G[V.c] * cu; if (dv < 12 || dvg < 12) return;
      var detour = (dv + dvg) / d0; if (detour > (opt && opt.flank ? 1.6 : 1.28)) return;
      // lateral offset from the straight line (flankers want it wide)
      var lx = gx - a.x, ly = gy - a.y, ll = Math.hypot(lx, ly) || 1, off = Math.abs((V.x - a.x) * ly - (V.y - a.y) * lx) / ll;
      // SMGs like the tight routes through buildings, ARs like the open lanes with long sightlines
      var indoor = P.g[V.c] === 2, v2 = (opt && opt.flank ? off * 0.06 - detour : -detour * 2 + off * 0.01) + (indoor === a.smg ? 0.35 : 0) + rnd() * 0.5;
      if (v2 > bv){ bv = v2; best = v; } });
    if (best >= 0) a.via = best;
  };
  var arrived = function(a, tol){ if (a.goal < 0) return true; var nd = P.nodes[a.goal]; return a.via < 0 && Math.hypot(nd.x - a.x, nd.y - a.y) < (tol || 2.2); };
  var nextWp = function(a, node){
    var D = field(P, node, P.nodes[node].lim), W = P.W, wk = P.wk, c = P.cell(a.x, a.y); if (c < 0) return null;
    var cur = c, path = [];
    for (var s = 0; s < 14; s++){
      var cx = cur % W, cy = (cur / W) | 0, best = -1, bv = D[cur];
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++){ if (!ox && !oy) continue; var nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= P.H) continue; var j = ny * W + nx; if (!wk[j]) continue; if (ox && oy && (!wk[cy * W + nx] || !wk[ny * W + cx])) continue; if (D[j] < bv){ bv = D[j]; best = j; } }
      if (best < 0) break; path.push(best); cur = best; if (D[cur] === 0) break;
    }
    if (!path.length) return null;
    var tries = [path.length - 1, Math.floor((path.length - 1) * 0.6), Math.floor((path.length - 1) * 0.3)];
    for (var q = 0; q < tries.length; q++){ var k = tries[q]; if (k <= 0) break; var x = P.cx(path[k]), y = P.cy(path[k]); if (clear(P, a.x, a.y, x, y)) return {x:x, y:y}; }
    return {x:P.cx(path[0]), y:P.cy(path[0])};
  };
  var turn = function(a){ if (a.fire >= 0) return; var d = angd(a.look - a.f); a.f += clamp(d, -6 * DT, 6 * DT); };
  var move = function(a){
    if (a.goal < 0 || a.busy){ a.still += DT; turn(a); return; }
    var node = a.via >= 0 ? a.via : a.goal, nd = P.nodes[node];
    if (a.via >= 0 && Math.hypot(nd.x - a.x, nd.y - a.y) < 6){ a.via = -1; a.wp = null; node = a.goal; nd = P.nodes[node]; }
    var dn = Math.hypot(nd.x - a.x, nd.y - a.y);
    if (node === a.goal && dn < 1.6){ a.still += DT; turn(a); return; }
    var spd = (P.g[P.cell(a.x, a.y)] === 6 ? 0.55 : 1) * MS.SPD * (a.smg ? 1.07 : 1) * (a.fire >= 0 ? (a.mode === "break" || a.mode === "go" ? 0.5 : 0.18) : 1) * (a.hp < 80 && a.mode !== "fall" ? 0.9 : 1) * DT;
    if (nd.direct){ a.wp = {x:nd.x, y:nd.y}; a.wpT = t + 99; }
    else if (!a.wp || t >= a.wpT || Math.hypot(a.wp.x - a.x, a.wp.y - a.y) < 1.2){ a.wp = dn < 4 && clear(P, a.x, a.y, nd.x, nd.y) ? {x:nd.x, y:nd.y} : nextWp(a, node); a.wpT = t + 0.35; }
    if (!a.wp){ a.still += DT; return; }
    var dx = a.wp.x - a.x, dy = a.wp.y - a.y, dd = Math.hypot(dx, dy) || 1, st = Math.min(spd, dd), nx = a.x + dx / dd * st, ny = a.y + dy / dd * st;
    if (!P.walk(nx, ny)){ a.wp = nextWp(a, node); a.wpT = t + 0.35; if (!a.wp) return; dx = a.wp.x - a.x; dy = a.wp.y - a.y; dd = Math.hypot(dx, dy) || 1; st = Math.min(spd, dd); nx = a.x + dx / dd * st; ny = a.y + dy / dd * st; if (!P.walk(nx, ny)) return; }
    a.x = nx; a.y = ny; a.still = 0; if (a.fire < 0){ var head = Math.atan2(dy, dx); a.f += clamp(angd(head - a.f), -7 * DT, 7 * DT); }
  };

  /* ---------- spots ---------- */
  // kind: "hold" (anchor around an objective we have, facing the enemy), "stage" (our side, waiting to break),
  // "flank" (wide, off to one side), "in" (inside the zone, away from known enemies)
  var spotFor = function(a, Z, kind){
    var kn = known(a.tm), mt = mates(a), our = centroid(mt.concat([a]), a), them = centroid(kn, null);
    var eA = them ? Math.atan2(them.y - Z.y, them.x - Z.x) : Math.atan2(our.y - Z.y, our.x - Z.x) + Math.PI, oA = Math.atan2(our.y - Z.y, our.x - Z.x);
    var claimed = mt.map(function(m){ return m.goal; });
    if (kind === "in"){ var bi = Z.inside[0], bvv = -1e9; Z.inside.forEach(function(n){ var nd = P.nodes[n], v = (them ? Math.hypot(nd.x - them.x, nd.y - them.y) / 30 : 0) - Math.hypot(nd.x - a.x, nd.y - a.y) / 40 + (claimed.indexOf(n) >= 0 ? -1.5 : 0) + rnd() * 0.6; if (v > bvv){ bvv = v; bi = n; } }); return bi; }
    var pool = kind === "stage" ? Z.hide.concat(Z.brk) : Z.spots.concat(kind === "hold" ? Z.hold.filter(function(s){ return !Z.mask[P.nodes[s.node].c]; }) : kind === "flank" ? Z.brk : []), side = a.i % 2 ? 1 : -1, best = null, bv = -1e9;
    pool.forEach(function(s){ var v, nd = P.nodes[s.node];
      if (kind === "hold") v = Math.cos(s.a - eA) * 1.2 - Math.abs(s.d - (a.smg ? Z.r + 10 : Z.r + 24)) / 16 + (s.kind === "hold" ? 0.9 : 0);
      else if (kind === "stage") v = Math.cos(s.a - oA) * 1.8 + (s.kind === "hide" ? 0.6 : 0.3) - (them ? Math.max(0, 45 - Math.hypot(nd.x - them.x, nd.y - them.y)) / 15 : 0) - Math.max(0, s.d - Z.r - 35) / 25;
      else v = Math.cos(s.a - (oA + side * 1.8)) * 1.6 + (them ? Math.min(Math.hypot(nd.x - them.x, nd.y - them.y), 70) / 50 : 0);
      if (claimed.indexOf(s.node) >= 0) v -= 2;
      mt.forEach(function(m){ if (Math.hypot(m.x - nd.x, m.y - nd.y) < 9) v -= 0.6; });
      v -= Math.hypot(nd.x - a.x, nd.y - a.y) / 330;
      v += rnd() * 0.5;
      if (v > bv){ bv = v; best = s; } });
    return best ? best.node : Z.node;
  };

  /* ---------- spawns ---------- */
  // spawns are not tied to a side: a team spawns where enemies aren't. Pushing past the enemy's spawn blocks it and flips them.
  var spawnBlocked = function(tm, nd){ var bad = 0; A.forEach(function(e){ if (e.tm === tm || !e.alive) return; var d = Math.hypot(e.x - nd.x, e.y - nd.y); if (d < SPB) bad += 3; else if (d < SPB * 2.2 && los(P, e.x, e.y, nd.x, nd.y, SPB * 2.2)) bad += 1.5; }); return bad; };
  var chooseSpawn = function(a, list, hill){
    var mt = mates(a), best = -1, bv = -1e9, my = team[a.tm];
    list.forEach(function(s){ var nd = P.nodes[s.node], v = 0, b = spawnBlocked(a.tm, nd);
      v -= b * 6;
      v += s.pri === 2 ? 2.2 : s.pri === 1 ? 0.8 : 0;
      if (hill) v -= Math.hypot(hill.x - nd.x, hill.y - nd.y) * 0.012;
      if (mt.length){ var md = Math.min.apply(null, mt.map(function(m){ return Math.hypot(m.x - nd.x, m.y - nd.y); })); v -= md * 0.02; }
      else if (my.side) v -= Math.hypot(my.side.x - nd.x, my.side.y - nd.y) * 0.012;
      A.forEach(function(e){ if (e.tm === a.tm || !e.alive) return; var d = Math.hypot(e.x - nd.x, e.y - nd.y); if (d < SPB * 2.5) v -= (SPB * 2.5 - d) * 0.02; });
      v += rnd() * 0.7;
      if (v > bv){ bv = v; best = s.node; } });
    return best;
  };

  /* ---------- combat (shared by every mode) ---------- */
  var onKill = null;
  var kill = function(k, v){
    v.alive = false; v.d++; v.streak = 0; v.fire = -1; v.tgt = -1; v.hp = 0; v.busy = false;
    if (k){ k.k++; k.streak++; k.best = Math.max(k.best, k.streak); k.multi = k.multi.filter(function(x){ return t - x < 4; }); k.multi.push(t); }
    var rec = {t:Math.round(t * 10) / 10, k:k ? k.i : -1, v:v.i, x:Math.round(v.x * 10) / 10, y:Math.round(v.y * 10) / 10, m:k ? k.multi.length : 0, s:k ? k.streak : 0};
    if (MS.DEBUG){ rec.km = k ? k.mode : ""; rec.vm = v.mode; rec.life = Math.round((t - (v.spawnT || 0)) * 10) / 10; rec.d = k ? Math.round(dist(k, v)) : 0; }
    if (onKill) onKill(k, v, rec);
    kills.push(rec);
  };
  var range = MS.RANGE, losV = new Int8Array(64), losT = new Float64Array(64).fill(-99), losP = new Float64Array(256);
  // line of sight per pair, reused while neither player has moved
  var seeAB = function(a, e, d){
    if (d > range) return false;
    var p = a.i < e.i ? a : e, q = p === a ? e : a, k = p.i * 8 + q.i, o = k * 4;
    if (t - losT[k] < 0.35 && Math.abs(losP[o] - p.x) + Math.abs(losP[o + 1] - p.y) + Math.abs(losP[o + 2] - q.x) + Math.abs(losP[o + 3] - q.y) < 0.5) return losV[k] === 1;
    var v = los(P, p.x, p.y, q.x, q.y, range); losV[k] = v ? 1 : 0; losT[k] = t; losP[o] = p.x; losP[o + 1] = p.y; losP[o + 2] = q.x; losP[o + 3] = q.y; return v;
  };
  var combat = function(zoneOf, zoneXY){
    for (var ai = 0; ai < 8; ai++){
      var a = A[ai]; if (!a.alive) continue;
      var best = null, bd = 1e9;
      for (var ei = 0; ei < 8; ei++){ var e = A[ei]; if (e.tm === a.tm || !e.alive) continue; var dx = e.x - a.x, dy = e.y - a.y, d = Math.sqrt(dx * dx + dy * dy); if (d >= bd || d > range) continue;
        var aware = a.tgt === e.i || d < 10 || (t - e.lastFire < 0.6 && d < 45) || (a.atk === e.i && t - a.lastHit < 1.5);
        if (!aware){ var ang = Math.atan2(dy, dx) - a.f; while (ang > Math.PI) ang -= 6.283185307179586; while (ang < -Math.PI) ang += 6.283185307179586; aware = ang < MS.FOV && ang > -MS.FOV; }
        if (aware && seeAB(a, e, d)){ bd = d; best = e; } }
      if (!best){ a.tgt = -1; a.fire = -1; continue; }
      var sn = team[a.tm].seen[best.i] || (team[a.tm].seen[best.i] = {t:0, x:0, y:0}); sn.t = t; sn.x = best.x; sn.y = best.y;
      if (a.tgt !== best.i){
        a.tgt = best.i;
        var pre = a.still > 0.6 ? 0.08 : 0, rt = clamp(0.3 - (a.p.gs - 78) * 0.004 - pre + gauss() * 0.05 + (best.still > 0.6 ? 0.04 : 0) + (a.busy ? 0.25 : 0), 0.06, 0.7);
        a.react = t + rt;
      }
      a.f = Math.atan2(best.y - a.y, best.x - a.x);
      a.fire = t >= a.react && !a.busy ? best.i : -1;
      if (a.fire >= 0) a.lastFire = t;
    }
    var hits = [];
    A.forEach(function(a){
      if (!a.alive || a.fire < 0) return; var e = A[a.fire]; if (!e.alive) return;
      var d = dist(a, e), smg = a.smg;
      var rm = smg ? (d < 30 ? 1.16 : d > 62 ? 0.76 : 1) : (d > 50 ? 1.12 : d < 18 ? 0.9 : 1);
      // short walls: a target tucked behind one is harder to hit
      var cdx = a.x - e.x, cdy = a.y - e.y, cd = Math.sqrt(cdx * cdx + cdy * cdy) || 1, cov = P.g[P.cell(e.x + cdx / cd * 2.2, e.y + cdy / cd * 2.2)] === 6 ? 0.75 : P.g[P.cell(e.x, e.y)] === 6 ? 0.88 : 1;
      var sm = (a.still > 0.5 ? 1.1 : 0.92) * (zoneOf && zoneOf(e) ? 1.06 : 1) * (e.busy ? 1.15 : 1) * cov;
      var ph = clamp(MS.HIT * Math.exp((a.p.gs - 78) / MS.SKILL) * rm * sm * team[a.tm].ex * (a.p.ni || 1), 0.05, 0.95);
      if (DT !== 0.1) ph = 1 - Math.pow(1 - ph, DT / 0.1);
      if (rnd() < ph) hits.push([a, e]);
    });
    // all shots in a tick land together, so both players can die in the same instant (a trade)
    hits.forEach(function(x){ var e = x[1]; e.hp -= MS.DMG; e.lastHit = t; e.atk = x[0].i; if (e.tgt < 0){ e.look = Math.atan2(x[0].y - e.y, x[0].x - e.x); } });
    hits.forEach(function(x){ var e = x[1]; if (e.alive && e.hp <= 0) kill(x[0], e); });
    // hurt and outgunned: some players back off to break sight and heal instead of finishing the fight
    hits.forEach(function(x){ var e = x[1], k = x[0]; if (!e.alive || e.mode === "fall" || e.hp > MS.FALL_HP || e.noFall) return;
      var seen = A.filter(function(o){ return o.alive && o.tm !== e.tm && o.fire === e.i; }).length;
      if (rnd() > MS.FALL * (mode === "CTL" ? MS.CTL.FALL : 1) * (seen >= 2 ? 1.6 : 1) * (1.3 - e.p.en / 100)) return;
      var c0 = P.cell(e.x, e.y), best = -1, bd = 1e9;
      for (var tr = 0; tr < 16; tr++){ var ang = rnd() * Math.PI * 2, rr = 3 + rnd() * MS.FALL_R, x = e.x + Math.cos(ang) * rr, y = e.y + Math.sin(ang) * rr; if (!P.walk(x, y)) continue;
        if (Math.hypot(x - k.x, y - k.y) < Math.hypot(e.x - k.x, e.y - k.y)) continue; if (zoneXY && e.mode !== "hold" && zoneXY(x, y)) continue; if (los(P, k.x, k.y, x, y, 999)) continue; if (rr < bd && clear(P, e.x, e.y, x, y)){ bd = rr; best = [x, y]; } }
      if (best){ var nn = addTmp(best[0], best[1], "direct"); e.mode = "fall"; e.goal = nn; e.via = -1; e.wp = null; e.fallT = t; e.fire = -1; e.react = t + 0.6; } });
    A.forEach(function(a){ if (a.alive && a.hp < MS.MAXHP && t - a.lastHit > 4) a.hp = Math.min(MS.MAXHP, a.hp + 100 * DT); });
  };
  // temporary nodes (fall-back spots) reuse a small pool so the field cache stays bounded
  var tmpN = 0;
  var addTmp = function(x, y, how){
    var direct = how === "direct", c = direct ? P.cell(x, y) : nearestWalk(P, x, y), lim = how === true ? 0 : 700;
    if (!direct) for (var q = 0; q < 40; q++){ var o = P.nodes[P.tmpBase + q]; if (!o.direct && o.c === c && o.lim === lim && P.fields[P.tmpBase + q]) return P.tmpBase + q; }
    var slot = P.tmpBase + (tmpN++ % 40), nd = P.nodes[slot];
    nd.direct = direct;
    if (nd.direct){ nd.c = c; nd.x = x; nd.y = y; nd.lim = 700; delete P.fields[slot]; return slot; }
    if (nd.c !== c || nd.lim !== lim){ nd.c = c; nd.x = P.cx(c); nd.y = P.cy(c); nd.lim = lim; delete P.fields[slot]; }
    return slot;
  };
  var fallDone = function(a){ if (a.mode !== "fall") return false; if (t - a.fallT < 2.2 || (a.hp < MS.MAXHP && t - a.fallT < 5)) return true; a.mode = "x"; a.goal = -1; return false; };
  var frameP = function(o){ return A.map(function(a){ return [Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.alive ? 1 : 0, Math.round(a.f * 100) / 100, a.alive ? a.fire : -1, Math.round(a.hp), a.k, a.d, o(a), a.alive ? 0 : Math.max(0, Math.ceil(a.resp - t))]; }); };

  var out;
  if (mode === "HP") out = runHP();
  else if (mode === "SND") out = runSND();
  else out = runCTL();
  out.kills = kills; out.frames = rec ? frames : null; out.map = P.name; out.mode = mode; out.v = MS.VERSION; out.len = Math.round(t * 10) / 10;
  return out;

  /* =========================== HARDPOINT =========================== */
  function runHP(){
    var C = MS.HP, hills = P.hills, cur = 0, hillStart = 0, hillPts = [0, 0], hlog = [], flips = [];
    var zoneOf = function(e){ return e.alive && hills[cur].mask[P.cell(e.x, e.y)] === 1; }, zxy = function(x, y){ return hills[cur].mask[P.cell(x, y)] === 1; };
    onKill = function(k, v){ v.resp = t + C.RESPAWN; var T = team[v.tm]; T.holders = T.holders.filter(function(i){ return i !== v.i; }); };
    var inZ = function(a, Z){ return a.alive && Z.mask[P.cell(a.x, a.y)] === 1; };
    // the team that gets to the next hill first holds it (red setups); the other team sets up to break (blue setups)
    var planRotation = function(nh){
      var dA = mean(aliveOf(0).map(function(a){ return pathD(a, nh.node); })), dB = mean(aliveOf(1).map(function(a){ return pathD(a, nh.node); }));
      team[0].rotHold = dA <= dB; team[1].rotHold = dB < dA;
    };
    var mean = function(arr){ return arr.length ? arr.reduce(function(x, y){ return x + y; }, 0) / arr.length : 999; };
    var lastSpawnSide = [null, null];
    var spawnList = function(){ return hills[cur].sp; };
    var decide = function(a){
      var h = hills[cur], nh = hills[(cur + 1) % hills.length], tl = C.HILL_SEC - (t - hillStart), T = team[a.tm];
      var kn = known(a.tm), them0 = centroid(kn, null);
      a.look = them0 ? Math.atan2(them0.y - a.y, them0.x - a.x) + gauss() * 0.5 : Math.atan2(h.y - a.y, h.x - a.x) + gauss() * 0.8;
      if (fallDone(a)) return;
      var holder = T.holders.indexOf(a.i) >= 0;
      var ours = 0, theirs = 0; for (var q = 0; q < 8; q++){ var b = A[q]; if (b.alive && h.mask[P.cell(b.x, b.y)] === 1){ if (b.tm === a.tm) ours++; else theirs++; } }
      // scrap time: the last stretch of a hill. Someone stays (or goes) to take or deny the last seconds while the rest set up the next hill
      if (tl <= C.SCRAP){
        if (T.scrap == null || !A[T.scrap].alive){
          var sc0 = aliveOf(a.tm).filter(function(b){ return b.i !== T.setter; }).sort(function(x, y){ return (y.obj * 0.5 + (T.holders.indexOf(y.i) >= 0 ? 2 : 0) - pathD(y, h.node) / 18) - (x.obj * 0.5 + (T.holders.indexOf(x.i) >= 0 ? 2 : 0) - pathD(x, h.node) / 18); })[0];
          T.scrap = sc0 ? sc0.i : null;
        }
        if (T.scrap === a.i){ if (a.mode !== "scrap" || rnd() < 0.08){ a.mode = "scrap"; setGoal(a, spotFor(a, h, "in")); } return; }
      }
      // rotate to the next hill (holders hang on until scrap time decides who stays)
      if (tl < a.rot && T.scrap !== a.i && !(holder && tl > C.SCRAP)){
        if (a.mode !== "rotate"){
          if (T.rotHold == null) planRotation(nh);
          a.mode = "rotate";
          // the first to rotate sets up the new hill: he's standing in it when it pops
          if (T.setter == null || !A[T.setter].alive || A[T.setter].mode !== "rotate"){ T.setter = a.i; setGoal(a, spotFor(a, nh, "in")); }
          else setGoal(a, spotFor(a, nh, T.rotHold ? "hold" : (rnd() < 0.35 ? "hold" : "stage")));
        }
        return;
      }
      if (a.mode === "rotate") a.mode = "x";
      if (theirs > 0){
        if (holder){ if (a.mode !== "hold"){ a.mode = "hold"; setGoal(a, spotFor(a, h, "in")); } return; }
        if (a.mode === "go" && t - a.goT < 6) return;
        // read the fight: who's around me vs. who they have on it. Only wait when outnumbered.
        var nE = Math.max(theirs, kn.filter(function(e){ return Math.hypot(e.x - h.x, e.y - h.y) < h.r + 40; }).length);
        var allies = 0; for (q = 0; q < 8; q++){ var m = A[q]; if (m.alive && m.tm === a.tm && (m === a || Math.hypot(m.x - a.x, m.y - a.y) < 55)) allies++; }
        var weak = A.filter(function(e){ return e.tm !== a.tm && e.alive && h.mask[P.cell(e.x, e.y)] === 1; }).every(function(e){ return e.hp < 100; });
        var slayer = (a.p.gs - 78) / 8 + (a.p.en - 50) / 40 + (a.smg ? 0.2 : 0);
        var go = allies >= nE || nE <= 1 || weak || tl < C.SCRAP + 2 || (nE - allies === 1 && rnd() < clamp(0.12 + slayer * 0.22, 0, 0.6));
        if (a.mode === "flank"){ if (arrived(a, 4)){ a.mode = "fwait"; a.wait = 0; } return; }
        if (a.mode === "fwait"){ a.wait += 0.5; var mateGoing = A.some(function(m){ return m.tm === a.tm && m.alive && m.mode === "go"; }); if (mateGoing || a.wait > 4 || go){ a.mode = "go"; a.goT = t; setGoal(a, spotFor(a, h, "in")); } return; }
        if (go){ a.mode = "go"; a.goT = t; setGoal(a, spotFor(a, h, "in")); return; }
        // outnumbered: pinch from a flank, or wait out of sight for help
        if (a.mode !== "stage"){ a.wait = 0; if (rnd() < a.flank * 0.5){ a.mode = "flank"; setGoal(a, spotFor(a, h, "flank"), {flank:true}); } else { a.mode = "stage"; setGoal(a, spotFor(a, h, "stage")); } return; }
        if (arrived(a, 5)) a.wait += 0.5;
        if (a.wait > 6 + (60 - a.p.en) / 12){ a.mode = "go"; a.goT = t; setGoal(a, spotFor(a, h, "in")); }
        return;
      }
      // we have it or nobody does: one to three sit on it; objective players lean toward being on it, slayers hold angles or push
      if (T.want == null) T.want = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.1 ? 1 : 0);
      var want = T.want;
      if (!holder && T.holders.length < want){
        var cand = aliveOf(a.tm).filter(function(b){ return T.holders.indexOf(b.i) < 0; }).sort(function(x, y){ return (y.obj - pathD(y, h.node) / 25) - (x.obj - pathD(x, h.node) / 25); });
        if (cand[0] === a || (cand[1] === a && rnd() < 0.35)){ T.holders.push(a.i); holder = true; }
      }
      if (holder){ if (a.mode !== "hold" || (rnd() < 0.08)){ a.mode = "hold"; setGoal(a, spotFor(a, h, "in")); } return; }
      if (["anchor", "push", "inhill"].indexOf(a.mode) < 0){
        var pIn = clamp(0.1 + a.obj * 0.1 + (kn.length ? -0.05 : 0.12), 0.02, 0.5), r0 = rnd();
        a.mode = r0 < pIn ? "inhill" : r0 < pIn + a.push ? "push" : "anchor";
        setGoal(a, spotFor(a, h, a.mode === "inhill" ? "in" : "hold"));
      }
      else if (a.mode === "anchor" && rnd() < 0.04) setGoal(a, spotFor(a, h, "hold"));
      if (a.mode === "push" && rnd() < 0.12){
        // push toward the enemy's side: take an angle just short of where they are (this is what flips spawns)
        if (kn.length){ var e = kn.reduce(function(b, q){ return !b || Math.hypot(a.x - q.x, a.y - q.y) < Math.hypot(a.x - b.x, a.y - b.y) ? q : b; }, null), bestN = -1, bd = 1e9;
          h.spots.concat(nh.spots).forEach(function(s){ var dd = Math.hypot(s.x - e.x, s.y - e.y); if (dd > 16 && dd < bd && Math.hypot(s.x - h.x, s.y - h.y) < 80){ bd = dd; bestN = s.node; } });
          if (bestN >= 0) setGoal(a, bestN); }
      }
    };
    // opening: both teams from their base spawns
    var flip = rnd() < 0.5 ? 1 : 0, base = M.HP.start;
    A.forEach(function(a){ var side = base[a.tm ^ flip], q = side[a.i % 4]; spawnAt(a, P.sn(q), hills[0]); a.spawnN = P.sn(q); });
    team.forEach(function(T, k){ T.side = {x:base[k ^ flip][0][0], y:base[k ^ flip][0][1]}; });
    while (t < C.LIMIT){
      var hi = Math.floor(t / C.HILL_SEC) % hills.length;
      if (hi !== cur){ hlog.push({h:cur, a:hillPts[0], b:hillPts[1], end:t}); hillPts = [0, 0]; cur = hi; hillStart = Math.floor(t / C.HILL_SEC) * C.HILL_SEC;
        team.forEach(function(T){ T.holders = []; T.brk = null; T.rotHold = null; T.want = null; T.scrap = null; T.setter = null; }); A.forEach(function(a){ if (a.mode !== "fall") a.mode = "x"; a.dec = 0; }); }
      var h = hills[cur];
      A.forEach(function(a){ if (!a.alive && t >= a.resp){ var sn = chooseSpawn(a, spawnList(), h); var nd = P.nodes[sn];
        // a team spawning on the other side of the map from where it was: that's a flip
        var prev = lastSpawnSide[a.tm]; var side = nd.x < (P.M.box[2] / 2) ? "w" : "e"; if (prev && prev !== side && t - (team[a.tm].lastFlipT || -99) > 12){ flips.push({t:Math.round(t * 10) / 10, tm:a.tm, h:cur}); team[a.tm].lastFlipT = t; } lastSpawnSide[a.tm] = side;
        spawnAt(a, sn, h); } });
      if (Math.round(t * 10) % 5 === 0) team.forEach(function(T){ var al = aliveOf(T.k); if (al.length) T.side = centroid(al, T.side); });
      for (var ii = 0; ii < 8; ii++){ var ag = A[ii]; if (!ag.alive) continue; ag.dec -= DT; if (ag.dec <= 0){ ag.dec = 0.5; decide(ag); } }
      combat(zoneOf, zxy);
      for (ii = 0; ii < 8; ii++) if (A[ii].alive) move(A[ii]);
      var na = 0, nb = 0, msk = h.mask;
      for (ii = 0; ii < 8; ii++){ var q = A[ii]; q.inz = q.alive && msk[P.cell(q.x, q.y)] === 1; if (q.inz){ if (q.tm) nb++; else na++; } }
      var who = na && !nb ? 0 : nb && !na ? 1 : -1;
      if (who >= 0){ var T = team[who]; T.acc += DT; if (T.acc >= 1){ T.acc -= 1; T.sc++; hillPts[who]++; }
        for (ii = 0; ii < 8; ii++){ var q2 = A[ii]; if (q2.inz && q2.tm === who){ q2.ot += DT; q2.hk[cur] += DT; if (MS.DEBUG){ MS.dbgZ = MS.dbgZ || {}; MS.dbgZ[q2.mode] = (MS.dbgZ[q2.mode] || 0) + DT; } } } }
      if (rec && t + 1e-6 >= frames.length * frameEvery){ frames.push({t:Math.round(t * 10) / 10, h:cur, tl:Math.max(0, Math.ceil(C.HILL_SEC - (t - hillStart))), s:[team[0].sc, team[1].sc], w:who, p:frameP(function(a){ return Math.floor(a.ot); })}); }
      t += DT;
      if (team[0].sc >= C.TARGET || team[1].sc >= C.TARGET) break;
    }
    hlog.push({h:cur, a:hillPts[0], b:hillPts[1], end:t});
    hlog = hlog.filter(function(x){ return x.a || x.b || x.end > 1; });
    var sc = [team[0].sc, team[1].sc];
    if (sc[0] === sc[1]) sc[rnd() < 0.5 ? 0 : 1]++;
    return {sc:sc, aw:sc[0] > sc[1], hills:hlog, flips:flips,
      lines:A.map(function(a){ return {k:a.k, d:a.d, o:Math.round(a.ot), best:a.best}; }), hk:A.map(function(a){ return a.hk.map(Math.round); })};
  }

  /* =========================== SEARCH AND DESTROY =========================== */
  function runSND(){
    var C = MS.SND, sites = P.sites, sc = [0, 0], rounds = [], rd = 0, first = rnd() < 0.5 ? 0 : 1;
    var atkSp = M.SND.atk, defSp = M.SND.def;
    while (sc[0] < C.WIN && sc[1] < C.WIN && rd < 30){
      var atk = (first + rd) % 2, def = 1 - atk, t0 = t;
      R = {n:rd, atk:atk, def:def, t0:t0, bomb:{st:0, c:-1, x:0, y:0, site:-1, pt:0, prog:0, by:-1}, fb:false, out:null, ev:[], exec:false};
      var atkP = A.filter(function(a){ return a.tm === atk; }), defP = A.filter(function(a){ return a.tm === def; });
      var avg = function(L, f){ return L.reduce(function(x, q){ return x + f(q); }, 0) / L.length; };
      /* ---- offense: bang a site, play for picks, play slow for info, or split up. What has worked before gets a bit more
         weight, but it stays a coin flip so the defense can't just read it. */
      var mem = team[atk].sndMem || (team[atk].sndMem = {site:[0, 0], plans:{}}), agg = avg(atkP, function(q){ return q.p.en; });
      var pw = {bang:0.16 + (agg - 50) / 220, picks:0.3, slow:0.28, split:0.24};
      Object.keys(pw).forEach(function(k){ pw[k] = Math.max(0.05, pw[k]) * (1 + Math.min(3, mem.plans[k] || 0) * 0.15); });
      var pr = rnd() * (pw.bang + pw.picks + pw.slow + pw.split); R.oplan = pr < pw.bang ? "bang" : pr < pw.bang + pw.picks ? "picks" : pr < pw.bang + pw.picks + pw.slow ? "slow" : "split";
      R.plan = rnd() * (2 + mem.site[0] * 0.4 + mem.site[1] * 0.4) < 1 + mem.site[0] * 0.4 ? 0 : 1;
      R.execAt = t0 + (R.oplan === "bang" ? 3 + rnd() * 7 : R.oplan === "split" ? 28 + rnd() * 16 : R.oplan === "picks" ? 38 + rnd() * 18 : 45 + rnd() * 15);
      var carrier = atkP.slice().sort(function(x, y){ return (y.obj + rnd()) - (x.obj + rnd()); })[0];
      R.bomb.c = carrier.i;
      var rest = atkP.filter(function(a){ return a !== carrier; }).sort(function(x, y){ return (y.flank + rnd() * 0.5) - (x.flank + rnd() * 0.5); });
      atkP.forEach(function(a){ a.role = "entry"; a.tgtS = R.plan; a.noFall = false; }); carrier.role = "carry";
      if (R.oplan === "split"){ var n2 = rnd() < 0.55 ? 2 : 1; rest.slice(0, n2).forEach(function(a){ a.role = n2 === 1 ? "island" : "side"; a.tgtS = 1 - R.plan; }); }
      else if ((R.oplan === "slow" && rnd() < 0.6) || (R.oplan === "picks" && rnd() < 0.4) || (R.oplan === "bang" && rnd() < 0.15)){ rest[0].role = "island"; rest[0].tgtS = 1 - R.plan; }
      atkP.forEach(function(a, j){ spawnAt(a, P.sn(atkSp[j]), sites[a.tgtS]); });
      // map control spots on the attackers' half (picks and slow play hold these, quietly)
      R.ctl = {}; R.ex = null;
      var aN = P.sn(atkSp[0]), dN = P.sn(defSp[0]), FA = field(P, aN), FD = field(P, dN);
      var half = P.via.filter(function(v){ var V = P.nodes[v]; return FA[V.c] < FD[V.c] * (R.oplan === "slow" ? 1.15 : 1.0); });
      atkP.forEach(function(a){ if (a.role === "island" || a.role === "side" || !half.length) return; var St = sites[a.tgtS];
        var opts = half.slice().sort(function(x, y){ return Math.hypot(P.nodes[x].x - St.x, P.nodes[x].y - St.y) - Math.hypot(P.nodes[y].x - St.x, P.nodes[y].y - St.y); }).slice(0, 5);
        var taken = Object.keys(R.ctl).map(function(k){ return R.ctl[k]; }), free = opts.filter(function(v){ return taken.indexOf(v) < 0; });
        R.ctl[a.i] = (free.length ? free : opts)[Math.floor(rnd() * Math.min(3, (free.length ? free : opts).length))]; });
      /* ---- defense: spread out for info (one on each site, two covering the lanes) or commit to the site they expect */
      var heavy = mem.site[0] + mem.site[1] > 0 && rnd() < 0.6 ? (mem.site[0] >= mem.site[1] ? 0 : 1) : rnd() < 0.5 ? 0 : 1;
      R.dplan = rnd() < 0.58 ? "spread" : "stack";
      var order = defP.slice().sort(function(x, y){ return (x.p.en - y.p.en) + (rnd() - 0.5) * 30; });   // calm players anchor, aggressive ones flex
      defP.forEach(function(a, j){ spawnAt(a, P.sn(defSp[j]), sites[heavy]); a.peek = false; });
      if (R.dplan === "spread") order.forEach(function(a, j){ a.role = j === 0 ? "anc" + heavy : j === 1 ? "anc" + (1 - heavy) : "flex"; a.peek = a.role === "flex" && rnd() < clamp((a.p.en - 40) / 60, 0.1, 0.7); });
      else order.forEach(function(a, j){ a.role = j < 3 ? "anc" + heavy : "anc" + (1 - heavy); a.peek = j === 2 && rnd() < 0.3; });
      var defHalf = P.via.filter(function(v){ var V = P.nodes[v]; return FD[V.c] < FA[V.c]; });
      A.forEach(function(a){ a.resp = 1e9; a.dec = rnd() * 0.5; a.busy = false; });
      var zoneOf = function(e){ var b = R.bomb; return b.st === 2 && Math.hypot(e.x - b.x, e.y - b.y) < 14; };
      onKill = function(k, v){
        if (!R.fb && k){ R.fb = true; k.o3++; v.fd++; }
        if (v.i === R.bomb.c && R.bomb.st === 0){ R.bomb.st = 1; R.bomb.x = v.x; R.bomb.y = v.y; R.bomb.c = -1; R.bomb.prog = 0; }
        if (R.bomb.by === v.i){ R.bomb.by = -1; R.bomb.prog = 0; }
        if (k){ var al = aliveOf(k.tm).length, el = aliveOf(v.tm).length; if (el === 0 && al === 1) R.clutchBy = k.i; }
      };
      R.clutch = [null, null];
      var bombNode = -1;
      var seenAt = function(kn){ var c = [0, 0]; kn.forEach(function(q){ sites.forEach(function(S, si){ if (Math.hypot(q.x - S.x, q.y - S.y) < 60) c[si]++; }); }); return c; };
      var decideA = function(a){
        var b = R.bomb, kn = known(a.tm), them = centroid(kn, null), el = t - t0;
        var S = sites[b.st === 2 ? b.site : R.exec ? R.plan : a.tgtS];
        a.look = them ? Math.atan2(them.y - a.y, them.x - a.x) + gauss() * 0.4 : Math.atan2(S.y - a.y, S.x - a.x) + gauss() * 0.7;
        if (fallDone(a)) return;
        if (b.st === 2){ // post-plant: spread around the bomb, some close, some holding the retake lanes
          if (a.mode !== "post"){ a.mode = "post"; setGoal(a, spotFor(a, sites[b.site], rnd() < 0.3 ? "stage" : "hold")); } return; }
        if (b.st === 1){ // dropped bomb: closest attacker picks it up
          var near = aliveOf(a.tm).sort(function(x, y){ return dist(x, b) - dist(y, b); })[0];
          if (near === a){ if (bombNode < 0 || a.mode !== "fetch"){ bombNode = addTmp(b.x, b.y, true); } a.mode = "fetch"; setGoal(a, bombNode); return; }
        }
        var nA = aliveOf(a.tm).length, nD = aliveOf(1 - a.tm).length, adv = nA - nD, seen = seenAt(kn);
        // mid-round read: go now when the numbers are there (picks plans go on the first man advantage) or time is short
        if (!R.exec && (t >= R.execAt || adv >= 2 || (R.oplan === "picks" && adv >= 1) || C.ROUND - el < 32)){
          R.exec = true;
          if (seen[R.plan] >= 2 && seen[1 - R.plan] === 0) R.plan = 1 - R.plan;            // the planned site is stacked: hit the other one
          else if (R.oplan === "split" && seen[R.plan] > seen[1 - R.plan]) R.plan = 1 - R.plan;
          R.ex = {state:R.oplan === "bang" ? "go" : "stage", t0:t};
          A.forEach(function(q){ if (q.tm === a.tm && q.alive){ q.dec = 0; if (q.mode !== "fetch") q.mode = "x"; } });
        }
        S = sites[R.exec ? R.plan : a.tgtS];
        if (!R.exec){
          if (a.role === "island" || a.role === "side"){ var O = sites[a.tgtS]; if (a.mode !== "island"){ a.mode = "island"; setGoal(a, spotFor(a, O, "stage"), {flank:true}); } return; }
          if (a.mode !== "early"){ a.mode = "early"; setGoal(a, R.ctl[a.i] != null ? R.ctl[a.i] : spotFor(a, S, "stage")); }
          return;
        }
        // an island player keeps the other site honest until the plant, unless he's the last few alive
        if (a.role === "island" && nA >= 3 && C.ROUND - el > 25){ if (a.mode !== "island"){ a.mode = "island"; setGoal(a, spotFor(a, sites[1 - R.plan], "stage"), {flank:true}); } return; }
        var B = R.ex;
        if (B.state === "stage"){
          if (a.mode !== "stage"){ a.mode = "stage"; a.wait = 0; setGoal(a, spotFor(a, S, "stage")); }
          if (arrived(a, 5)) a.wait += 0.5;
          var staged = aliveOf(a.tm).filter(function(m){ return m.mode === "stage" && arrived(m, 6); }).length, al = aliveOf(a.tm).length;
          if (staged >= Math.min(3, al) || (staged >= 2 && a.wait > 2) || t - B.t0 > 10 || C.ROUND - el < 22 || seen[R.plan] === 0 && staged >= 1 && a.wait > 1){ B.state = "go"; }
          return;
        }
        if (b.c === a.i){ a.mode = "plant"; setGoal(a, S.node); return; }
        if (a.mode !== "exec"){ a.mode = "exec"; setGoal(a, spotFor(a, S, rnd() < 0.55 ? "in" : "hold")); }
      };
      var decideD = function(a){
        var b = R.bomb, kn = known(a.tm), them = centroid(kn, null), el = t - t0;
        var home = a.role === "flex" ? null : sites[+a.role.slice(3)];
        a.look = them ? Math.atan2(them.y - a.y, them.x - a.x) + gauss() * 0.4 : home ? Math.atan2(home.y - a.y, home.x - a.x) + Math.PI + gauss() * 0.9 : a.look;
        if (fallDone(a)) return;
        if (b.st === 2){
          // retake: group up near the site, then the best objective player defuses while the rest clear
          var S = sites[b.site], left = C.BOMB - (t - b.pt), al = aliveOf(a.tm);
          if (!R.defuser || !A[R.defuser].alive) R.defuser = al.slice().sort(function(x, y){ return (pathD(x, S.node) - x.obj * 6) - (pathD(y, S.node) - y.obj * 6); })[0].i;
          var enemiesLeft = aliveOf(1 - a.tm).length;
          var grouped = al.filter(function(m){ return pathD(m, S.node) < 55; }).length;
          var go = grouped >= Math.min(2, al.length) || left < 20 || enemiesLeft === 0 || al.length >= enemiesLeft + 2;
          if (R.defuser === a.i && (go || enemiesLeft === 0)){ a.mode = "defuse"; if (bombNode < 0) bombNode = addTmp(b.x, b.y, true); setGoal(a, bombNode); return; }
          if (!go){ if (a.mode !== "rgrp"){ a.mode = "rgrp"; setGoal(a, spotFor(a, S, "stage")); } return; }
          if (a.mode !== "retake"){ a.mode = "retake"; setGoal(a, spotFor(a, S, "in")); }
          return;
        }
        var seen = seenAt(kn), hot = seen[0] > seen[1] ? 0 : seen[1] > seen[0] ? 1 : -1;
        if (b.st === 1){ hot = Math.hypot(b.x - sites[0].x, b.y - sites[0].y) < Math.hypot(b.x - sites[1].x, b.y - sites[1].y) ? 0 : 1; }
        var mine = home ? sites.indexOf(home) : -1;
        var mates2 = aliveOf(a.tm).length, foes = aliveOf(1 - a.tm).length;
        // up big late with no plant: go hunting
        if (foes <= 1 && mates2 >= 3 && el > 35 && kn.length){ if (a.mode !== "hunt" || Math.hypot(kn[0].x - a.hx, kn[0].y - a.hy) > 25){ a.mode = "hunt"; a.hx = kn[0].x; a.hy = kn[0].y; setGoal(a, addTmp(kn[0].x, kn[0].y, true)); } return; }
        // info: a site is getting hit. Flex and (sometimes) the other anchor rotate; a stacked site sends help faster
        if (hot >= 0 && hot !== mine && seen[hot] >= (R.dplan === "stack" ? 1 : 2) && (a.role === "flex" || rnd() < (mates2 > foes ? 0.45 : 0.25))){ if (a.mode !== "rot" + hot){ a.mode = "rot" + hot; setGoal(a, spotFor(a, sites[hot], "hold")); } return; }
        if (hot >= 0 && hot !== mine && seen[hot] === 1 && a.role === "flex"){ if (a.mode !== "rot" + hot){ a.mode = "rot" + hot; setGoal(a, spotFor(a, sites[hot], "stage")); } return; }
        // early in the round an aggressive flex peeks a lane for a pick, then falls back
        if (a.peek && el < 22 && !kn.length && defHalf.length){ if (a.mode !== "peek"){ a.mode = "peek"; var far = defHalf.slice().sort(function(x, y){ return FD[P.nodes[y].c] - FD[P.nodes[x].c]; }); setGoal(a, far[Math.floor(rnd() * Math.min(3, far.length))]); } return; }
        if (a.mode !== "anc"){ a.mode = "anc"; var Sx = home || sites[rnd() < 0.5 ? 0 : 1];
          setGoal(a, home ? spotFor(a, Sx, "hold") : defHalf.length ? defHalf.slice().sort(function(x, y){ return FA[P.nodes[x].c] - FA[P.nodes[y].c]; })[Math.floor(rnd() * Math.min(3, defHalf.length))] : Sx.node); }
      };
      var roundOver = false, endT = null;
      while (!roundOver){
        var el = t - t0, b = R.bomb;
        A.forEach(function(a){ if (!a.alive) return; a.dec -= DT; if (a.dec <= 0){ a.dec = 0.5; (a.tm === atk ? decideA : decideD)(a); } });
        combat(zoneOf);
        A.forEach(function(a){ if (a.alive) move(a); });
        // bomb pickup
        if (b.st === 1){ A.forEach(function(a){ if (a.alive && a.tm === atk && b.st === 1 && Math.hypot(a.x - b.x, a.y - b.y) < 3){ b.st = 0; b.c = a.i; a.mode = "x"; bombNode = -1; } }); }
        // planting
        if (b.st === 0){ var cr = A[b.c];
          if (cr && cr.alive){ var si = -1; sites.forEach(function(S, k){ if (Math.hypot(cr.x - S.px, cr.y - S.py) < 6) si = k; });
            if (si >= 0 && cr.mode === "plant"){ if (b.by !== cr.i){ b.by = cr.i; b.prog = 0; } cr.busy = true; b.prog += DT / C.PLANT;
              if (b.prog >= 1){ b.st = 2; b.site = si; b.x = cr.x; b.y = cr.y; b.pt = t; b.by = -1; b.prog = 0; cr.busy = false; cr.o1++; R.planter = cr.i; R.ev.push({t:t, k:"plant", i:cr.i, s:si}); bombNode = -1; A.forEach(function(q){ if (q.alive){ q.mode = "x"; q.dec = 0; } }); } }
            else { if (b.by === cr.i){ b.by = -1; b.prog = 0; } cr.busy = false; } } }
        // defusing
        if (b.st === 2){ var df = null; A.forEach(function(a){ if (a.alive && a.tm === def && a.mode === "defuse" && Math.hypot(a.x - b.x, a.y - b.y) < 3.5) df = a; });
          if (df){ if (b.by !== df.i){ b.by = df.i; b.prog = 0; } df.busy = true; b.prog += DT / C.DEFUSE; if (b.prog >= 1){ b.st = 3; df.busy = false; df.o2++; R.defuserDone = df.i; } }
          else if (b.by >= 0){ if (A[b.by]) A[b.by].busy = false; b.by = -1; b.prog = 0; } }
        var na = 0, nd = 0; for (var ii = 0; ii < 8; ii++) if (A[ii].alive){ if (A[ii].tm === atk) na++; else nd++; }
        // last-alive clutch bookkeeping
        if (na === 1 && nd >= 1 && !R.clutch[atk]) R.clutch[atk] = {i:aliveOf(atk)[0].i, vs:nd};
        if (nd === 1 && na >= 1 && !R.clutch[def]) R.clutch[def] = {i:aliveOf(def)[0].i, vs:na};
        if (b.st === 3){ R.out = {w:def, why:"defuse"}; }
        else if (b.st === 2 && t - b.pt >= C.BOMB){ R.out = {w:atk, why:"bomb"}; }
        else if (nd === 0){ R.out = {w:atk, why:"elim"}; }
        else if (na === 0 && b.st !== 2){ R.out = {w:def, why:"elim"}; }
        else if (b.st !== 2 && el >= C.ROUND){ R.out = {w:def, why:"time"}; }
        if (rec && t + 1e-6 >= frames.length * frameEvery){
          var tl = b.st === 2 ? C.BOMB - (t - b.pt) : C.ROUND - el;
          frames.push({t:Math.round(t * 10) / 10, r:rd, atk:atk, tl:Math.max(0, Math.ceil(tl)), s:sc.slice(), b:[Math.round(b.st === 0 && A[b.c] ? A[b.c].x : b.x), Math.round(b.st === 0 && A[b.c] ? A[b.c].y : b.y), b.st, b.c, Math.round(b.prog * 100) / 100, b.site], p:frameP(function(a){ return a.o1 * 10 + a.o2; })}); }
        t += DT;
        if (R.out){ roundOver = true; }
      }
      sc[R.out.w]++;
      (function(){ var m = team[atk].sndMem; if (R.out.w === atk){ m.plans[R.oplan] = (m.plans[R.oplan] || 0) + 1; if (R.bomb.site >= 0) m.site[R.bomb.site]++; } else { m.plans[R.oplan] = Math.max(0, (m.plans[R.oplan] || 0) - 0.5); } })();
      var cl = R.clutch[R.out.w], won = R.out.w, kr = kills.filter(function(k){ return k.t >= t0; });
      var ace = null; [0, 1, 2, 3, 4, 5, 6, 7].forEach(function(i){ if (kr.filter(function(k){ return k.k === i; }).length >= 4) ace = i; });
      rounds.push({r:rd + 1, atk:atk, w:won, why:R.out.why, op:R.oplan, dp:R.dplan, s:sc.slice(), planter:R.planter != null ? R.planter : -1, site:R.bomb.site, defuser:R.defuserDone != null ? R.defuserDone : -1,
        fb:kr.length ? kr[0].k : -1, clutch:cl && aliveOf(won).length >= 1 && cl.i != null && A[cl.i].alive && cl.vs >= 1 && A[cl.i].tm === won ? {i:cl.i, vs:cl.vs} : null, ace:ace, end:Math.round(t * 10) / 10, kills:kr.length});
      // gap between rounds (shown as a short pause in the viewer)
      if (rec){ var gEnd = t + C.GAP; while (t < gEnd){ if (t + 1e-6 >= frames.length * frameEvery){ var lf = frames[frames.length - 1]; frames.push({t:Math.round(t * 10) / 10, r:rd, atk:atk, tl:0, s:sc.slice(), b:lf.b, p:lf.p, gap:1}); } t += DT; } }
      else t += C.GAP;
      rd++;
    }
    return {sc:sc, aw:sc[0] > sc[1], rounds:rounds, lines:A.map(function(a){ return {k:a.k, d:a.d, o1:a.o1, o2:a.o2, o3:a.o3, fd:a.fd, best:a.best}; })};
  }

  /* =========================== CONTROL =========================== */
  function runCTL(){
    var C = MS.CTL, zones = P.zones, sc = [0, 0], rounds = [], rd = 0, first = rnd() < 0.5 ? 0 : 1;
    var atkSp = M.CTL.atk, defSp = M.CTL.def;
    var capMul = [0, 1, 1.5, 1.8, 2];
    while (sc[0] < C.WIN && sc[1] < C.WIN && rd < 9){
      var atk = (first + rd) % 2, def = 1 - atk, t0 = t, lives = [0, 0], rlen = C.ROUND;
      lives[atk] = C.LIVES; lives[def] = C.LIVES;
      var Z = zones.map(function(){ return {p:0, cp:0, lock:false}; }), plan = rnd() < 0.62 ? 0 : 1, otime = false;
      R = {atk:atk, def:def, plan:plan, ok:[0, 0]};
      var atkP = A.filter(function(a){ return a.tm === atk; }), defP = A.filter(function(a){ return a.tm === def; });
      atkP.forEach(function(a, j){ lives[atk]--; spawnAt(a, P.sn(atkSp[j % atkSp.length]), zones[plan]); });
      var heavy = rnd() < 0.5 ? 0 : 1;
      defP.forEach(function(a, j){ lives[def]--; spawnAt(a, P.sn(defSp[j % defSp.length]), zones[heavy]); a.home = j < 2 ? heavy : j === 2 ? 1 - heavy : (rnd() < 0.5 ? 0 : 1); });
      team.forEach(function(T){ T.brk = null; T.holders = []; });
      A.forEach(function(a){ a.resp = 1e9; a.busy = false; a.dec = rnd() * 0.5; });
      var active = function(){ var c = []; Z.forEach(function(z, i){ if (!z.lock) c.push(i); }); return c; };
      var inZi = function(a, i){ return a.alive && zones[i].mask[P.cell(a.x, a.y)] === 1; };
      var zoneOf = function(e){ return active().some(function(i){ return inZi(e, i); }); };
      onKill = function(k, v){
        v.resp = lives[v.tm] > 0 ? t + C.RESPAWN : 1e9;
        // objective kill: either player on or right around a live zone
        if (k){ var obj = active().some(function(i){ var z = zones[i]; return Math.hypot(v.x - z.x, v.y - z.y) < z.r + 14 || Math.hypot(k.x - z.x, k.y - z.y) < z.r + 14; }); if (obj){ k.o1++; R.ok[k.tm]++; } }
      };
      var target = function(){ var ac = active(); if (ac.indexOf(plan) >= 0) return plan; return ac[0]; };
      var decideA = function(a){
        var zi = target(), S = zones[zi], T = team[a.tm], kn = known(a.tm), them = centroid(kn, null);
        a.look = them ? Math.atan2(them.y - a.y, them.x - a.x) + gauss() * 0.5 : Math.atan2(S.y - a.y, S.x - a.x) + gauss() * 0.7;
        if (fallDone(a)) return;
        var defOn = A.some(function(e){ return e.tm !== a.tm && inZi(e, zi); }), mineOn = A.filter(function(m){ return m.tm === a.tm && inZi(m, zi); }).length;
        if (mineOn && !defOn){ if (a.mode !== "cap" && a.mode !== "cover"){ var capN = A.filter(function(m){ return m.tm === a.tm && m.mode === "cap"; }).length; a.mode = capN < 2 || a.obj > 0.5 ? "cap" : "cover"; setGoal(a, spotFor(a, S, a.mode === "cap" ? "in" : "hold")); } return; }
        // same break logic as Hardpoint: stage, group, go in together; flankers pinch
        var B = T.brk && T.brk.z === zi ? T.brk : (T.brk = {z:zi, state:"stage", t0:t});
        if (["stage", "flank", "fwait", "go"].indexOf(a.mode) < 0 || a.zi !== zi){ a.zi = zi; a.wait = 0;
          if (rnd() < a.flank * 0.5){ a.mode = "flank"; setGoal(a, spotFor(a, S, "flank"), {flank:true}); } else { a.mode = "stage"; setGoal(a, spotFor(a, S, "stage")); } }
        var pushing = A.filter(function(m){ return m.tm === a.tm && m.alive && m.mode === "go" && m !== a; }).length;
        if (B.state === "go" && t - B.goT > 8 && !pushing){ T.brk = B = {z:zi, state:"stage", t0:t}; if (a.mode === "go"){ a.mode = "stage"; setGoal(a, spotFor(a, S, "stage")); } }
        var left = rlen - (t - t0);
        // with lives to spend, a fresh spawn joins a push that's already on (he isn't alone: his teammates are in the fight)
        if (a.mode === "stage" && B.state === "go" && pushing && lives[a.tm] > 6){ a.mode = "go"; setGoal(a, spotFor(a, S, "in")); return; }
        if (a.mode === "flank"){ if (arrived(a, 4)){ a.mode = "fwait"; a.wait = 0; } return; }
        if (a.mode === "fwait"){ a.wait += 0.5; if (B.state === "go" || a.wait > 5 || left < 18){ a.mode = "go"; setGoal(a, spotFor(a, S, "in")); } return; }
        if (a.mode === "stage"){ a.wait += arrived(a, 5) ? 0.5 : 0;
          var stagers = A.filter(function(m){ return m.tm === a.tm && m.alive && (m.mode === "stage" || m.mode === "fwait") && dist(m, a) < 60; }).length, al = aliveOf(a.tm).length, soon = A.filter(function(m){ return m.tm === a.tm && !m.alive && m.resp - t < 3; }).length;
          if ((stagers >= Math.min(3, al) || (stagers >= 2 && a.wait > 2 && !soon) || a.wait > 5 || left < 22) && B.state !== "go"){ B.state = "go"; B.goT = t; }
          if (B.state === "go"){ a.mode = "go"; setGoal(a, spotFor(a, S, "in")); } }
      };
      var decideD = function(a){
        var ac = active(), T = team[a.tm], kn = known(a.tm), them = centroid(kn, null);
        // go where the attackers are capping or massing
        var hot = -1, hv = 0; ac.forEach(function(i){ var z = Z[i], v = z.p * 3 + A.filter(function(e){ return e.tm !== a.tm && e.alive && Math.hypot(e.x - zones[i].x, e.y - zones[i].y) < zones[i].r + 40; }).length; if (v > hv){ hv = v; hot = i; } });
        var my = ac.indexOf(a.home) >= 0 ? a.home : ac[0];
        var zi = hot >= 0 && (hv >= 2 || ac.length === 1) ? hot : my, S = zones[zi];
        a.look = them ? Math.atan2(them.y - a.y, them.x - a.x) + gauss() * 0.5 : Math.atan2(S.y - a.y, S.x - a.x) + Math.PI + gauss() * 0.9;
        if (fallDone(a)) return;
        var atkOn = A.some(function(e){ return e.tm !== a.tm && inZi(e, zi); });
        if (atkOn || Z[zi].p > 0.05){ if (a.mode !== "contest" || a.zi !== zi){ a.mode = "contest"; a.zi = zi; setGoal(a, spotFor(a, S, "in")); } return; }
        if (a.mode !== "dhold" || a.zi !== zi || rnd() < 0.03){ a.mode = "dhold"; a.zi = zi; setGoal(a, spotFor(a, S, "hold")); }
      };
      var out = null;
      while (!out){
        var el = t - t0;
        A.forEach(function(a){ if (!a.alive && t >= a.resp && lives[a.tm] > 0){ lives[a.tm]--; var sp = a.tm === atk ? (Z.some(function(z){ return z.lock; }) && M.CTL.atk2 ? atkSp.concat(M.CTL.atk2) : atkSp) : defSp, list = sp.map(function(q){ return {node:P.sn(q), pri:0}; }); spawnAt(a, chooseSpawn(a, list, null), zones[target()]); } });
        A.forEach(function(a){ if (!a.alive) return; a.dec -= DT; if (a.dec <= 0){ a.dec = 0.5; (a.tm === atk ? decideA : decideD)(a); } });
        if (MS.DEBUG){ MS.dbgM = MS.dbgM || {}; A.forEach(function(a){ var k = (a.tm === atk ? "A:" : "D:") + (a.alive ? a.mode : "dead"); MS.dbgM[k] = (MS.dbgM[k] || 0) + DT; }); }
        combat(zoneOf);
        A.forEach(function(a){ if (a.alive) move(a); });
        // capture: progress only while attackers stand in the zone uncontested; it falls back to the last third when they leave
        var capping = false;
        active().forEach(function(i){ var z = Z[i], na = A.filter(function(a){ return a.tm === atk && inZi(a, i); }).length, nd = A.filter(function(a){ return a.tm === def && inZi(a, i); }).length;
          if (na && !nd){ z.p += DT / C.CAP * capMul[Math.min(4, na)]; capping = true; if (z.p >= 1){ z.p = 1; z.lock = true; rlen += C.BONUS; R.bonus = (R.bonus || 0) + C.BONUS; A.forEach(function(a){ if (a.tm === atk && inZi(a, i)) a.cap = (a.cap || 0) + 1; }); A.forEach(function(q){ q.mode = "x"; q.dec = 0; }); } else z.cp = Math.max(z.cp, Math.floor(z.p * 3) / 3); }
          else if (na && nd){ capping = true; }
          // defenders on an uncontested zone burn it back down to the last finished third (faster with more of them); empty zones drift down slowly
          else if (!na) z.p = Math.max(z.cp, z.p - DT / C.CAP * (nd ? capMul[Math.min(4, nd)] : 0.35)); });
        var aliveA = aliveOf(atk).length, aliveD = aliveOf(def).length;
        if (Z.every(function(z){ return z.lock; })) out = {w:atk, why:"cap"};
        else if (lives[def] <= 0 && aliveD === 0) out = {w:atk, why:"lives"};
        else if (lives[atk] <= 0 && aliveA === 0) out = {w:def, why:"lives"};
        else if (el >= rlen && (!capping || el >= rlen + C.OT)) out = {w:def, why:"time"};
        otime = el >= rlen && capping;
        if (rec && t + 1e-6 >= frames.length * frameEvery){ frames.push({t:Math.round(t * 10) / 10, r:rd, atk:atk, tl:Math.max(0, Math.ceil(rlen - el)), ot:otime ? 1 : 0, s:sc.slice(), z:Z.map(function(z){ return [Math.round(z.p * 100) / 100, z.lock ? 1 : 0]; }), lv:lives.slice(), p:frameP(function(a){ return a.o1; })}); }
        t += DT;
      }
      sc[out.w]++;
      var top = A.filter(function(a){ return a.tm === out.w; }).sort(function(x, y){ return (y.o1 + y.k * 0.2) - (x.o1 + x.k * 0.2); })[0];
      rounds.push({r:rd + 1, atk:atk, w:out.w, why:out.why, s:sc.slice(), caps:Z.filter(function(z){ return z.lock; }).length, zl:Z.map(function(z){ return z.lock ? 1 : 0; }), lives:lives.slice(), star:top ? top.i : -1, end:Math.round(t * 10) / 10});
      if (rec){ var gEnd = t + C.GAP; while (t < gEnd){ if (t + 1e-6 >= frames.length * frameEvery){ var lf = frames[frames.length - 1]; frames.push({t:Math.round(t * 10) / 10, r:rd, atk:atk, tl:0, s:sc.slice(), z:lf.z, lv:lf.lv, p:lf.p, gap:1}); } t += DT; } }
      else t += C.GAP;
      rd++;
    }
    return {sc:sc, aw:sc[0] > sc[1], rounds:rounds, lines:A.map(function(a){ return {k:a.k, d:a.d, o1:a.o1, best:a.best}; })};
  }
};

/* ---------------- play-by-play from what happened on the map ---------------- */
MS.story = function(res, names){
  var nm = function(i){ return names[i] || "?"; }, P = prep(res.map), ev = [];
  if (res.mode === "SND"){
    res.rounds.forEach(function(r){
      var side = r.w === 0 ? "a" : "b", t, hl = false, site = r.site >= 0 ? P.sites[r.site].c : "";
      if (r.ace != null && (r.ace < 4) === (r.w === 0)){ t = nm(r.ace) + " gets the ACE"; hl = true; }
      else if (r.clutch && r.clutch.vs >= 2){ t = nm(r.clutch.i) + " wins a 1v" + r.clutch.vs + " clutch" + (r.clutch.vs >= 3 ? "!" : ""); hl = true; }
      else if (r.why === "defuse") t = nm(r.defuser) + " defuses on " + site;
      else if (r.why === "bomb") t = nm(r.planter) + " plants " + site + " and they hold it down";
      else if (r.why === "time") t = "Time runs out — the defense holds";
      else if (r.clutch && r.clutch.vs === 1) t = nm(r.clutch.i) + " wins the 1v1";
      else if (r.fb >= 0) t = nm(r.fb) + " gets the first blood" + ((r.fb < 4) === (r.w === 0) ? "" : ", but they lose the round");
      else t = "Round to " + (r.w === 0 ? "the home side" : "the away side");
      ev.push({r:r.r, s:r.s.slice(), w:side, t:t, hl:hl, tm:r.end});
    });
    return ev;
  }
  if (res.mode === "CTL"){
    res.rounds.forEach(function(r){
      var side = r.w === 0 ? "a" : "b", atkWon = r.w === r.atk, t, star = r.star >= 0 ? nm(r.star) : "";
      if (atkWon && r.why === "cap") t = star + " leads the push and they take both points";
      else if (atkWon) t = "The defense runs out of lives — " + star + " and company take the round";
      else if (r.why === "lives") t = "The attack runs out of lives" + (r.caps ? " after taking " + P.zones[r.zl.indexOf(1)].c : "");
      else t = star + " and the defense hold" + (r.caps ? " after losing " + P.zones[r.zl.indexOf(1)].c : " both points");
      var close = !atkWon && r.caps === 1 || (r.lives[r.w] <= 2);
      ev.push({r:r.r, s:r.s.slice(), w:side, t:t + (r.lives[r.w] <= 2 ? " with " + r.lives[r.w] + (r.lives[r.w] === 1 ? " life" : " lives") + " left" : ""), hl:close, tm:r.end});
    });
    return ev;
  }
  var ca = 0, cb = 0, lead = 0;
  var bigK = res.kills.filter(function(k){ return k.k >= 0 && (k.m === 3 || k.m === 4 || k.s === 8 || k.s === 12); });
  var hl = res.hills, ki = 0, fi = 0, fl = res.flips || [];
  hl.forEach(function(x, n){
    var hill = P.hills[x.h], start = n ? hl[n - 1].end : 0;
    while (ki < bigK.length && bigK[ki].t <= x.end){ var b = bigK[ki++], side = b.k < 4 ? "a" : "b";
      ev.push({tm:b.t, w:side, hl:true, t:b.m >= 3 ? nm(b.k) + (b.m === 4 ? " gets a QUAD on " : " gets a triple on ") + hill.n : nm(b.k) + " is on a " + b.s + "-kill streak"}); }
    // one spawn-flip line per hill at most (the first real one)
    var flipped = false;
    while (fi < fl.length && fl[fi].t <= x.end){ var f = fl[fi++]; if (!flipped && f.t - start > 10){ flipped = true; ev.push({tm:f.t, w:f.tm === 0 ? "b" : "a", t:(f.tm === 0 ? "Away side" : "Home side") + " flips the spawns on " + hill.n}); } }
    ca += x.a; cb += x.b;
    var big = x.a >= 42 ? "a" : x.b >= 42 ? "b" : null, nl = ca > cb ? 1 : ca < cb ? -1 : 0, t;
    if (big){ var top = -1, tv = -1; for (var i = big === "a" ? 0 : 4, e = i + 4; i < e; i++){ var hv = res.hk ? res.hk[i][x.h] : 0; if (hv > tv){ tv = hv; top = i; } } t = (top >= 0 && res.hk ? nm(top) + " anchors " : big === "a" ? "Home side holds " : "Away side holds ") + hill.n + " (" + hill.c + ") for +" + (big === "a" ? x.a : x.b); }
    else if (nl && lead && nl !== lead) t = "Lead change on " + hill.n + " (" + hill.c + ")";
    else t = hill.n + " (" + hill.c + ") split " + x.a + "-" + x.b;
    ev.push({r:n + 1, s:[ca, cb], w:x.a >= x.b ? "a" : "b", t:t, hl:!!big || (nl && lead && nl !== lead), tm:x.end});
    if (nl) lead = nl;
  });
  ev.sort(function(p, q){ return p.tm - q.tm; });
  var last = ev.filter(function(e){ return e.s; }).slice(-1)[0]; if (last) last.s = res.sc.slice();
  return ev;
};
})(typeof window !== "undefined" ? window : globalThis);
