/* DYNASTY UI: the live minimap for maps played out by dyn-mapsim (Hardpoint, Search and Destroy, Control):
   arrows, walls and doors, hills / bomb sites / control zones, the bomb, killfeed, live box score. */
(function(){
"use strict";
var DY = window.DY, X = window.DYU, U = X.U, esc = X.esc, P = X.P;
var COL = ["#ff6b4a", "#3fc6ff"], COL_D = ["rgba(255,107,74,.28)", "rgba(63,198,255,.28)"];
X.clock = function(t){ t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + ("0" + t % 60).slice(-2); };
X.visOk = function(mp){ return !!(mp && mp.vis && DY.MS && DY.MS.MAPS[mp.vis.map] && DY.MS.VERSION === (mp.vis.v || 1) && !mp.visBad && typeof document !== "undefined" && document.createElement("canvas").getContext); };

/* ---------- static map art (cached per map and size) ----------
   The walls the sim uses (AJ's painted layout, one cell ~1.5 px of map) are drawn as smooth shapes: the cell grid is
   upscaled with bilinear filtering and re-thresholded, so blocks get clean edges instead of stair steps. The real
   minimap (M.art, registered onto the same frame) sits underneath as texture. */
var ART = {}, ARTIMG = {};
function artImg(MP){
  var a = MP.M.art; if (!a || typeof Image === "undefined") return null;
  var im = ARTIMG[MP.name];
  if (!im){ im = ARTIMG[MP.name] = new Image(); im.onload = function(){ im.ok = true; Object.keys(ART).forEach(function(k){ if (k.indexOf(MP.name + "|") === 0) delete ART[k]; }); }; im.src = a.src; }
  return im.ok ? im : null;
}
// smooth mask of the cells passing test(), drawn into a w x h canvas in the given colour (alpha 0..1)
function smoothMask(MP, test, w, h, S, rgb, alpha, lo, hi){
  var W = MP.W, H = MP.H, g = MP.g, b = MP.M.box, c = document.createElement("canvas"); c.width = W + 2; c.height = H + 2;
  var cx = c.getContext("2d"), id = cx.createImageData(W + 2, H + 2), d = id.data;
  // 3x3 blur (twice) on the cell mask first: diagonal walls come out as clean slopes instead of stair steps
  var W2 = W + 2, H2 = H + 2, m = new Float32Array(W2 * H2), t2 = new Float32Array(W2 * H2);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (test(g[y * W + x])) m[(y + 1) * W2 + x + 1] = 1;
  for (var pass = 0; pass < 2; pass++){
    for (var yy = 1; yy < H2 - 1; yy++) for (var xx = 1; xx < W2 - 1; xx++){ var k0 = yy * W2 + xx; t2[k0] = (m[k0] * 4 + (m[k0 - 1] + m[k0 + 1] + m[k0 - W2] + m[k0 + W2]) * 2 + m[k0 - W2 - 1] + m[k0 - W2 + 1] + m[k0 + W2 - 1] + m[k0 + W2 + 1]) / 16; }
    var sw = m; m = t2; t2 = sw;
  }
  for (var q2 = 0; q2 < W2 * H2; q2++) d[q2 * 4 + 3] = Math.round(m[q2] * 255);
  cx.putImageData(id, 0, 0);
  var o = document.createElement("canvas"); o.width = w; o.height = h; var ox = o.getContext("2d");
  ox.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in ox) ox.imageSmoothingQuality = "high";
  var cs = MP.CS * S; ox.drawImage(c, (-b[0] - MP.CS) * S, (-b[1] - MP.CS) * S, (W + 2) * cs, (H + 2) * cs);
  var od = ox.getImageData(0, 0, w, h), q = od.data; lo = lo == null ? 110 : lo; hi = hi == null ? 150 : hi;
  for (var k = 0; k < q.length; k += 4){ var a = q[k + 3], t = a <= lo ? 0 : a >= hi ? 1 : (a - lo) / (hi - lo); q[k] = rgb[0]; q[k + 1] = rgb[1]; q[k + 2] = rgb[2]; q[k + 3] = Math.round(t * alpha * 255); }
  ox.putImageData(od, 0, 0); return o;
}
function mapArt(MP, S){
  var im = artImg(MP), key = MP.name + "|" + S + "|" + (im ? 1 : 0); if (ART[key]) return ART[key];
  var b = MP.M.box, w = Math.round((b[2] - b[0]) * S), h = Math.round((b[3] - b[1]) * S), c = document.createElement("canvas"); c.width = w; c.height = h;
  var x = c.getContext("2d");
  x.fillStyle = "#0a0d10"; x.fillRect(0, 0, w, h);
  // floor: map footprint, with the real minimap as texture when it has loaded
  var foot = smoothMask(MP, function(v){ return v !== 0; }, w, h, S, [36, 42, 48], 1, 96, 140);
  var fl = document.createElement("canvas"); fl.width = w; fl.height = h; var fx = fl.getContext("2d");
  fx.drawImage(foot, 0, 0);
  fx.globalCompositeOperation = "source-atop";
  fx.drawImage(smoothMask(MP, function(v){ return v === 2 || v === 5; }, w, h, S, [62, 70, 78], 1), 0, 0);   // indoor floor a shade lighter
  if (im){ var a = MP.M.art; fx.globalAlpha = 0.3; fx.drawImage(im, (a.x - b[0]) * S, (a.y - b[1]) * S, a.w * S, a.h * S); fx.globalAlpha = 1; fx.fillStyle = "rgba(12,16,20,.28)"; fx.fillRect(0, 0, w, h); }
  fx.globalCompositeOperation = "source-over";
  // map edge glow
  x.save(); x.shadowColor = "rgba(150,165,180,.28)"; x.shadowBlur = 2 * S / 2; x.drawImage(fl, 0, 0); x.restore();
  // walls: a light rim, then the solid block (so every building has a clean outline)
  x.drawImage(smoothMask(MP, function(v){ return v === 4; }, w, h, S, [104, 116, 128], 1, 84, 112), 0, 0);
  x.drawImage(smoothMask(MP, function(v){ return v === 4; }, w, h, S, [22, 27, 33], 1, 118, 140), 0, 0);
  // Checkmate plane: walk under it, it blocks sight
  x.drawImage(smoothMask(MP, function(v){ return v === 5; }, w, h, S, [120, 92, 140], 0.75), 0, 0);
  // short walls / cover you can see over
  x.drawImage(smoothMask(MP, function(v){ return v === 6; }, w, h, S, [176, 184, 192], 0.95, 70, 110), 0, 0);
  ART[key] = c; return c;
}
function shapePath(x, Z, px, py, S){
  var sh = Z.sh; x.beginPath();
  if (sh.r) x.arc(px(sh.x), py(sh.y), sh.r * S, 0, Math.PI * 2);
  else { sh.pts.forEach(function(q, i){ if (i) x.lineTo(px(q[0]), py(q[1])); else x.moveTo(px(q[0]), py(q[1])); }); x.closePath(); }
}

/* ---------- block inside the box score ---------- */
var OBJ_H = {HP:"Hill", SND:"P/D", CTL:"Obj"}, NOTE = {
  HP:"Arrows are players (numbers match the table). The filled shape is the live hill; a dashed outline marks the next one. Every kill, death and second on the hill here is what goes in the box score.",
  SND:"Arrows are players (numbers match the table). The diamond is the bomb. One life per round; P/D is plants/defuses. Every kill, plant and defuse here is what goes in the box score.",
  CTL:"Arrows are players (numbers match the table). A and B fill as the attackers capture them; each side has 30 lives a round. Every kill here is what goes in the box score (Obj = kills on or around a live zone)."};
X.visBlock = function(rec, mp, A, B){
  var v = U.vis, ids = mp.la.map(function(x){ return x[0]; }).concat(mp.lb.map(function(x){ return x[0]; })), md = mp.vis.mode || "HP";
  var spd = U.visSpd || {slow:3, normal:6, fast:12}[U.speed || "normal"];
  var side = function(t, k){ return '<div class="vis-side"><div class="vis-tn" style="color:' + COL[k] + '">' + esc(t.abbr) + ' <small class="muted" id="vis-tag' + k + '"></small></div><table class="tb vis-tb"><thead><tr><th>#</th><th></th><th class="n">K</th><th class="n">D</th><th class="n">' + OBJ_H[md] + '</th></tr></thead><tbody>' + ids.slice(k * 4, k * 4 + 4).map(function(id, j){ var i = k * 4 + j; return '<tr id="vis-r' + i + '"><td><span class="vis-no" style="background:' + COL[k] + '">' + (i + 1) + '</span></td><td>' + esc(P(id).n) + '</td><td class="n" id="vis-k' + i + '">0</td><td class="n" id="vis-d' + i + '">0</td><td class="n" id="vis-o' + i + '">' + (md === "HP" ? "0s" : md === "SND" ? "0/0" : "0") + '</td></tr>'; }).join("") + '</tbody></table></div>'; };
  return '<div class="vis"><div class="vis-hud"><span class="vis-sc" style="color:' + COL[0] + '">' + esc(A.abbr) + ' <b id="vis-sa">0</b></span><span class="vis-mid"><b id="vis-hn">' + (md === "HP" ? (function(){ var h = DY.MS.MAPS[mp.vis.map].HP.hills[0]; return h.c + " · " + h.n; })() : "Round 1") + '</b><small id="vis-ht">' + (md === "HP" ? "1:00" : "1:30") + '</small></span><span class="vis-sc" style="color:' + COL[1] + '"><b id="vis-sb">0</b> ' + esc(B.abbr) + '</span></div>' +
    '<div class="vis-stage"><canvas id="vis-cv" aria-label="Live minimap" style="aspect-ratio:' + (function(){ var bx = DY.MS.MAPS[mp.vis.map].box; return bx[2] + "/" + bx[3]; })() + '"></canvas><div class="vis-feed" id="vis-feed"></div><div class="vis-clock" id="vis-clk">0:00</div><div class="vis-banner" id="vis-ban"></div></div>' +
    '<div class="vis-ctl"><span class="lab">Speed</span>' + [1, 3, 6, 12, 24].map(function(x){ return '<button class="chip" data-a="visSpd" data-arg="' + x + '" aria-pressed="' + (spd === x) + '">' + x + 'x</button>'; }).join("") + '<button class="chip" data-a="visPause" aria-pressed="' + !!(v && v.pause) + '">' + (v && v.pause ? "Play" : "Pause") + '</button></div>' +
    '<div class="grid2 vis-lines">' + side(A, 0) + side(B, 1) + '</div><p class="sm vis-note">' + NOTE[md] + '</p></div>';
};

/* ---------- playback ---------- */
X.stopVis = function(){ if (U.visRaf){ cancelAnimationFrame(U.visRaf); U.visRaf = null; } U.vis = null; };
X.startVis = function(){
  var m = U.modal, mp = m.arg.maps[m.cur];
  if (U.vis && U.vis.mp === mp){ if (!U.visRaf) U.visRaf = requestAnimationFrame(tick); return; }
  X.stopVis();
  var res;
  try { res = DY.MS.run(mp.vis, {rec:true}); } catch (e){ res = null; }
  if (!res || res.sc[0] !== mp.sc[0] || res.sc[1] !== mp.sc[1]){ mp.visBad = true; m.keep = true; X.renderModal(); return; }
  U.vis = {mp:mp, rec:m.arg, cur:m.cur, res:res, P:DY.MS.prep(mp.vis.map), t:0, last:0, pause:false, feedN:-1, evN:-1, kills:res.kills, md:res.mode || "HP"};
  U.visRaf = requestAnimationFrame(tick);
};
function tick(now){
  U.visRaf = null;
  var v = U.vis, m = U.modal; if (!v || !m || m.kind !== "box" || !m.live || m.arg !== v.rec || m.cur !== v.cur){ X.stopVis(); return; }
  var ev = v.mp.ev || []; if (m.evN >= ev.length){ X.stopVis(); return; }
  var spd = U.visSpd || {slow:3, normal:6, fast:12}[U.speed || "normal"];
  if (v.last && !v.pause) v.t += Math.min(0.1, (now - v.last) / 1000) * spd;
  v.last = now;
  var end = v.res.len;
  if (v.t >= end){ m.evN = ev.length; m.keep = true; X.stopVis(); X.renderModal(); return; }
  draw(v);
  // play-by-play catches up with the clock
  var n = 0; while (n < ev.length && ev[n].tm != null && ev[n].tm <= v.t) n++;
  if (n !== m.evN){ m.evN = n; var ol = document.getElementById("vis-pbp"); if (ol){ ol.innerHTML = ev.slice(0, n).map(function(e){ return X.pbpLi(e, v.mp); }).join(""); } }
  U.visRaf = requestAnimationFrame(tick);
}
function lerpAng(a, b, f){ var d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }
function label(x, t, X0, Y0, dpr, col){ x.font = "700 " + Math.round(12 * dpr) + "px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 3 * dpr; x.strokeStyle = "rgba(0,0,0,.75)"; x.strokeText(t, X0, Y0); x.fillStyle = col; x.fillText(t, X0, Y0); }
function draw(v){
  var cv = document.getElementById("vis-cv"); if (!cv) return;
  var MP = v.P, b = MP.M.box, bw = b[2] - b[0], bh = b[3] - b[1], cssW = Math.min(cv.clientWidth || 320, cv.clientHeight ? cv.clientHeight * (b[2] - b[0]) / (b[3] - b[1]) : 1e9), dpr = Math.min(2, window.devicePixelRatio || 1), S = cssW / bw * dpr;
  var Wd = Math.round(bw * S), Hd = Math.round(bh * S); if (cv.width !== Wd || cv.height !== Hd){ cv.width = Wd; cv.height = Hd; }
  var x = cv.getContext("2d"), fr = v.res.frames, fi = Math.min(fr.length - 1, Math.floor(v.t / 0.2)), F = fr[fi], F2 = fr[Math.min(fr.length - 1, fi + 1)], f = clamp01((v.t - F.t) / 0.2), md = v.md;
  var px = function(xx){ return (xx - b[0]) * S; }, py = function(yy){ return (yy - b[1]) * S; };
  x.clearRect(0, 0, Wd, Hd);
  x.drawImage(mapArt(MP, Math.round(S * 100) / 100), 0, 0, Wd, Hd);
  x.setLineDash([]);
  // objectives
  if (md === "HP"){
    MP.hills.forEach(function(h, i){
      var cur = i === F.h, next = i === (F.h + 1) % MP.hills.length;
      shapePath(x, h, px, py, S);
      if (cur){ x.fillStyle = F.w === 0 ? COL_D[0] : F.w === 1 ? COL_D[1] : "rgba(255,255,255,.14)"; x.fill(); x.lineWidth = 2 * dpr; x.strokeStyle = F.w === 0 ? COL[0] : F.w === 1 ? COL[1] : "#e9edf1"; x.stroke(); }
      else if (next && F.tl <= 30){ x.lineWidth = 1.4 * dpr; x.strokeStyle = "rgba(233,237,241,.65)"; x.setLineDash([4 * dpr, 4 * dpr]); x.stroke(); x.setLineDash([]); }
      else { x.lineWidth = 1 * dpr; x.strokeStyle = "rgba(233,237,241,.13)"; x.stroke(); }
      label(x, h.c, px(h.x), py(h.y), dpr, cur ? "#fff" : "rgba(233,237,241,.45)");
    });
  } else if (md === "SND"){
    var bm = F.b;
    MP.sites.forEach(function(s, i){ var hot = bm && bm[2] >= 2 && bm[5] === i; x.beginPath(); x.arc(px(s.px), py(s.py), 6.5 * S / 2.2, 0, Math.PI * 2); x.fillStyle = hot ? "rgba(255,80,60,.35)" : "rgba(255,255,255,.08)"; x.fill(); x.lineWidth = 1.4 * dpr; x.strokeStyle = hot ? "#ff5a3c" : "rgba(233,237,241,.55)"; x.stroke(); label(x, s.c, px(s.px), py(s.py) - 7 * S / 2.2 - 6 * dpr, dpr, "#fff"); });
    if (bm && bm[2] !== 0 && bm[2] !== 4){ var BX = px(bm[0]), BY = py(bm[1]), r = 4.2 * dpr, pulse = bm[2] === 2 ? 0.6 + 0.4 * Math.abs(Math.sin(v.t * 4)) : 1;
      x.save(); x.translate(BX, BY); x.rotate(Math.PI / 4); x.fillStyle = bm[2] === 3 ? "#7ee081" : "rgba(255,90,60," + pulse + ")"; x.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4); x.lineWidth = 1 * dpr; x.strokeStyle = "#000"; x.strokeRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4); x.restore(); }
    if (bm && bm[4] > 0){ var cx0 = bm[2] === 0 && F.p[bm[3]] ? F.p[bm[3]] : null, PX = cx0 ? px(cx0[0]) : px(bm[0]), PY = cx0 ? py(cx0[1]) : py(bm[1]); x.beginPath(); x.arc(PX, PY, 9 * dpr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bm[4]); x.lineWidth = 2.4 * dpr; x.strokeStyle = bm[2] === 2 ? "#7ee081" : "#ffcf4a"; x.stroke(); }
  } else {
    MP.zones.forEach(function(z, i){ var st = F.z ? F.z[i] : [0, 0], atkC = COL[F.atk], defC = COL[1 - F.atk];
      shapePath(x, z, px, py, S); x.fillStyle = st[1] ? COL_D[F.atk] : "rgba(255,255,255,.07)"; x.fill(); x.lineWidth = 1.6 * dpr; x.strokeStyle = st[1] ? atkC : defC; x.stroke();
      if (!st[1] && st[0] > 0){ x.beginPath(); x.arc(px(z.x), py(z.y), 7 * dpr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st[0]); x.lineWidth = 3 * dpr; x.strokeStyle = atkC; x.stroke(); }
      label(x, z.c, px(z.x), py(z.y), dpr, "#fff"); });
  }
  // deaths in the last 3 seconds
  v.kills.forEach(function(k){ if (k.t > v.t || v.t - k.t > 3) return; var a = 1 - (v.t - k.t) / 3, c = k.v < 4 ? COL[0] : COL[1], X0 = px(k.x), Y0 = py(k.y), s = 3.5 * dpr; x.globalAlpha = a; x.strokeStyle = c; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo(X0 - s, Y0 - s); x.lineTo(X0 + s, Y0 + s); x.moveTo(X0 + s, Y0 - s); x.lineTo(X0 - s, Y0 + s); x.stroke(); x.globalAlpha = 1; });
  // players
  var pos = F.p.map(function(p, i){ var q = F2.p[i]; var lerp = p[2] && q[2] && Math.hypot(q[0] - p[0], q[1] - p[1]) < 8; return {x:lerp ? p[0] + (q[0] - p[0]) * f : p[0], y:lerp ? p[1] + (q[1] - p[1]) * f : p[1], al:p[2], a:lerp ? lerpAng(p[3], q[3], f) : p[3], fire:p[4], hp:p[5]}; });
  pos.forEach(function(p, i){ if (!p.al || p.fire < 0) return; var e = pos[p.fire]; if (!e || !e.al) return; x.strokeStyle = i < 4 ? "rgba(255,170,150,.55)" : "rgba(150,220,255,.55)"; x.lineWidth = 1 * dpr; x.beginPath(); x.moveTo(px(p.x), py(p.y)); x.lineTo(px(e.x), py(e.y)); x.stroke(); });
  pos.forEach(function(p, i){
    if (!p.al) return; var X0 = px(p.x), Y0 = py(p.y), r = Math.max(5.5, Math.min(9, cssW / 105)) * dpr, c = i < 4 ? COL[0] : COL[1];
    x.save(); x.translate(X0, Y0); x.rotate(p.a);
    x.beginPath(); x.moveTo(r * 1.35, 0); x.lineTo(-r * 0.85, r * 0.85); x.lineTo(-r * 0.4, 0); x.lineTo(-r * 0.85, -r * 0.85); x.closePath();
    x.fillStyle = c; x.fill(); x.lineWidth = (p.fire >= 0 ? 1.6 : 1) * dpr; x.strokeStyle = p.fire >= 0 ? "#fff" : "rgba(0,0,0,.7)"; x.stroke(); x.restore();
    x.fillStyle = "#fff"; x.font = "700 " + Math.round(Math.max(9, Math.min(13, cssW / 70)) * dpr) + "px ui-monospace,monospace"; x.textAlign = "left"; x.textBaseline = "middle";
    x.strokeStyle = "rgba(0,0,0,.8)"; x.lineWidth = 2.5 * dpr; x.strokeText(String(i + 1), X0 + r * 0.9, Y0 - r * 0.9); x.fillText(String(i + 1), X0 + r * 0.9, Y0 - r * 0.9);
    if (md === "SND" && F.b && F.b[2] === 0 && F.b[3] === i){ x.save(); x.translate(X0 - r * 1.3, Y0 + r * 1.2); x.rotate(Math.PI / 4); x.fillStyle = "#ff5a3c"; x.fillRect(-2 * dpr, -2 * dpr, 4 * dpr, 4 * dpr); x.restore(); }
    if (p.hp < 150){ x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(X0 - r, Y0 + r * 1.2, r * 2, 2 * dpr); x.fillStyle = p.hp > 75 ? "#e9edf1" : "#ffcf4a"; x.fillRect(X0 - r, Y0 + r * 1.2, r * 2 * Math.max(0, p.hp) / 150, 2 * dpr); }
  });
  // HUD + live box
  var set = function(id, t){ var el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; };
  var hs = document.querySelector(".dy-modal .mapc.now .mh .s"), hk = F.s[0] + "-" + F.s[1]; if (hs && hs.getAttribute("data-k") !== hk){ hs.setAttribute("data-k", hk); hs.textContent = X.T(v.rec.a).abbr + " " + F.s[0] + " – " + F.s[1] + " " + X.T(v.rec.b).abbr; }
  set("vis-sa", String(F.s[0])); set("vis-sb", String(F.s[1])); set("vis-clk", X.clock(v.t));
  var ht = document.getElementById("vis-ht"), ban = "";
  if (md === "HP"){ var h = MP.hills[F.h]; set("vis-hn", h.c + " · " + h.n); set("vis-ht", (F.w >= 0 ? "Held · " : "") + X.clock(F.tl)); if (ht) ht.style.color = F.w === 0 ? COL[0] : F.w === 1 ? COL[1] : ""; }
  else if (md === "SND"){ var st = F.b ? F.b[2] : 0; set("vis-hn", "Round " + (F.r + 1)); set("vis-ht", st === 2 ? "Bomb · " + X.clock(F.tl) : st === 3 ? "Defused" : X.clock(F.tl)); if (ht) ht.style.color = st === 2 ? "#ff5a3c" : "";
    var na = F.p.slice(0, 4).filter(function(q){ return q[2]; }).length, nb = F.p.slice(4).filter(function(q){ return q[2]; }).length;
    set("vis-tag0", (F.atk === 0 ? "ATK" : "DEF") + " · " + na + " alive"); set("vis-tag1", (F.atk === 1 ? "ATK" : "DEF") + " · " + nb + " alive");
    if (F.gap){ var rr = v.res.rounds[F.r]; if (rr) ban = (rr.w === 0 ? X.T(v.rec.a).abbr : X.T(v.rec.b).abbr) + " win round " + (F.r + 1); } }
  else { set("vis-hn", "Round " + (F.r + 1) + (F.ot ? " · OT" : "")); set("vis-ht", X.clock(F.tl)); if (ht) ht.style.color = F.ot ? "#ff5a3c" : "";
    set("vis-tag0", (F.atk === 0 ? "ATK" : "DEF") + " · " + (F.lv ? F.lv[0] : 0) + " lives"); set("vis-tag1", (F.atk === 1 ? "ATK" : "DEF") + " · " + (F.lv ? F.lv[1] : 0) + " lives");
    if (F.gap){ var r2 = v.res.rounds[F.r]; if (r2) ban = (r2.w === 0 ? X.T(v.rec.a).abbr : X.T(v.rec.b).abbr) + " win round " + (F.r + 1); } }
  set("vis-ban", ban); var bn = document.getElementById("vis-ban"); if (bn) bn.style.display = ban ? "" : "none";
  F.p.forEach(function(p, i){ set("vis-k" + i, String(p[6])); set("vis-d" + i, String(p[7])); set("vis-o" + i, md === "HP" ? p[8] + "s" : md === "SND" ? Math.floor(p[8] / 10) + "/" + p[8] % 10 : String(p[8])); var row = document.getElementById("vis-r" + i); if (row){ var dead = !p[2]; if (row.classList.contains("dead") !== dead) row.classList.toggle("dead", dead); } });
  // killfeed: last 4 kills within 6 seconds
  var feed = v.kills.filter(function(k){ return k.t <= v.t && v.t - k.t < 6; }).slice(-4), key = feed.map(function(k){ return k.t + "|" + k.v; }).join(",");
  if (key !== v.feedKey){ v.feedKey = key; var fe = document.getElementById("vis-feed"), ids = v.mp.la.map(function(q){ return q[0]; }).concat(v.mp.lb.map(function(q){ return q[0]; }));
    if (fe) fe.innerHTML = feed.map(function(k){ var kn = k.k >= 0 ? esc(P(ids[k.k]).n) : "", vn = esc(P(ids[k.v]).n); return '<div><b style="color:' + COL[k.k < 4 ? 0 : 1] + '">' + kn + '</b> <span class="muted">' + (k.m >= 3 ? "×" + k.m : "▸") + '</span> <b style="color:' + COL[k.v < 4 ? 0 : 1] + '">' + vn + '</b></div>'; }).join(""); }
}
function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
})();
