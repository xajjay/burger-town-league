/* DYNASTY: league setup, fantasy draft, schedule, match engine, regular season, pools, 12-team playoff, academy league, awards. */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, rint = DY.rint, rr = DY.rr, pick = DY.pick, shuffle = DY.shuffle, chance = DY.chance, wpick = DY.wpick, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };

/* =====================================================================================
   NEW DYNASTY
   ===================================================================================== */
DY.newDynasty = function(opts, data){
  var g = {v:DY.VERSION, rs:(Date.now() ^ Math.floor(Math.random() * 1e9)) | 0, created:Date.now(), season:1, phase:"draft", week:1, round:0,
    user:0, teams:[], minors:[], P:{}, nid:0, news:[], hist:[], tx:[], offers:[], res:[], mres:[], sched:[], msched:[], po:null, mpo:null,
    awards:null, off:null, retiredIds:[], hof:[], ext:{}, fa:null, settings:{}, pr:[], notes:[], weekLog:[]};
  DY.setG(g);
  var fits = DY.fitKd(data.players);
  data.players.forEach(function(d){ var p = DY.realPlayer(d, g.nid++, fits); g.P[p.id] = p; });
  // ---- franchises: 4 per region, user takes one slot in the region that fits their city ----
  var uCity = (opts.city || "Burger Town").trim(), uNick = (opts.nick || "").trim(), uPool = DY.regionFor(uCity) || pick(DY.POOLS);
  var taken = {}, uKey = uCity.toLowerCase(); taken[uKey] = 1;
  if (uKey === "las vegas" || uKey === "vegas") taken["las vegas"] = 1;
  var ducks = false, teams = [];
  DY.POOLS.forEach(function(pool){
    var need = pool === uPool ? 3 : 4, opts2 = shuffle(DY.FRANCHISES.filter(function(f){ return f.pool === pool && !taken[f.city.toLowerCase()]; }));
    opts2.forEach(function(f){ if (need <= 0) return; if (f.ducks && ducks) return; if (f.ducks) ducks = true; taken[f.city.toLowerCase()] = 1; teams.push(Object.assign({}, f)); need--; });
  });
  var abbr = (opts.abbr || uCity.replace(/[^A-Za-z]/g, "").slice(0, 3)).toUpperCase().slice(0, 4) || "YOU";
  if (teams.some(function(t){ return t.abbr === abbr; })) abbr = abbr.slice(0, 2) + "X";
  teams.push({city:uCity, nick:uNick, abbr:abbr, pool:uPool, mkt:1.0, user:true, c1:opts.c1 || "#f27f0c", c2:opts.c2 || "#1b1b1b"});
  teams = shuffle(teams);
  g.teams = teams.map(function(f, i){
    var t = {id:i, city:f.city, nick:f.nick, name:(f.city + " " + f.nick).trim(), abbr:f.abbr, pool:f.pool, user:!!f.user, mkt:f.mkt, c1:f.c1 || "#888888", c2:f.c2 || "#111111", shape:i % 5,
      roster:[], lineup:[], tag:"Buying", budget:DY.START_BUDGET, cashAdj:0, dead:0, hist:[], w:0, l:0, mw:0, ml:0, h2h:{}, streak:0,
      fan:{eng:clamp(46 + (f.mkt - 1) * 35 + gauss() * 4, 25, 75)}, style:pick(["balanced", "stars", "youth", "value"]), rivals:[], titles:0, legacyIds:{}};
    t.fan.base = t.fan.eng; return t;
  });
  g.user = g.teams.findIndex(function(t){ return t.user; });
  g.teams.forEach(function(t){ t.rivals = g.teams.filter(function(o){ return o.pool === t.pool && o.id !== t.id; }).map(function(o){ return o.id; }); });
  // ---- fantasy draft order (snake) ----
  g.draft = {order:shuffle(g.teams.map(function(t){ return t.id; })), n:0, picks:[], taken:{}};
  DY.news("league", "Welcome to the Dynasty", "Sixteen franchises, four pools and one player pool. The fantasy draft is on the clock. Stephen A. Sizzle is in the building and he has THOUGHTS.", {});
  return g;
};

/* =====================================================================================
   ROSTER HELPERS
   ===================================================================================== */
var isAR = function(p){ return p.role === "AR" || p.flex != null; }, isSMG = function(p){ return p.role === "SMG" || p.flex != null; };
DY.roleCounts = function(ids){ var P = G().P, ar = 0, smg = 0, fx = 0; ids.forEach(function(id){ var p = P[id]; if (p.flex != null) fx++; else if (p.role === "AR") ar++; else smg++; }); return {ar:ar, smg:smg, fx:fx}; };
// a lineup/roster can field 2 AR + 2 SMG (flex players count as either)
DY.canField = function(ids){ var c = DY.roleCounts(ids); return Math.max(0, 2 - c.ar) + Math.max(0, 2 - c.smg) <= c.fx && ids.length >= 4; };
// can a roster of these players still reach 2 AR + 2 SMG with the open spots left?
DY.roleFeasible = function(ids){ return DY.offRole(ids.length >= 4 ? ids : ids) <= Math.max(0, DY.ROSTER - ids.length) || (function(){ var c = DY.roleCounts(ids); return Math.max(0, Math.max(0, 2 - c.ar) + Math.max(0, 2 - c.smg) - c.fx) <= DY.ROSTER - ids.length; })(); };
DY.validRoster = function(ids){ return ids.length >= 4 && ids.length <= DY.ROSTER && DY.canField(ids); };
DY.offRole = function(ids){ var c = DY.roleCounts(ids); return Math.max(0, Math.max(0, 2 - c.ar) + Math.max(0, 2 - c.smg) - c.fx); };
DY.playerVal = function(p){ return p.ovr + p.form + p.hot + (p.rel - 55) / 30; };
DY.bestLineup = function(ids){
  var P = G().P; if (ids.length <= 4) return ids.slice();
  var best = null, bv = -1e9;
  var combos = [];
  (function rec(start, cur){ if (cur.length === 4){ combos.push(cur.slice()); return; } for (var i = start; i < ids.length; i++){ cur.push(ids[i]); rec(i + 1, cur); cur.pop(); } })(0, []);
  combos.forEach(function(l){ var v = sum(l.map(function(i){ return DY.playerVal(P[i]); })) - 6 * DY.offRole(l); if (v > bv){ bv = v; best = l; } });
  return best;
};
DY.fixLineup = function(t){
  var l = (t.lineup || []).filter(function(i){ return t.roster.indexOf(i) >= 0; });
  if (t.user && G().settings.auto){ t.lineup = DY.bestLineup(t.roster); return; }
  if (t.user && l.length === 4 && DY.offRole(l) === 0) { t.lineup = l; return; }
  if (t.user && l.length < 4){ var rest = t.roster.filter(function(i){ return l.indexOf(i) < 0; }).sort(function(a, b){ return DY.playerVal(G().P[b]) - DY.playerVal(G().P[a]); }); while (l.length < 4 && rest.length) l.push(rest.shift()); if (DY.offRole(l) === 0){ t.lineup = l; return; } }
  t.lineup = DY.bestLineup(t.roster);
};
DY.sub = function(t){ return t.roster.find(function(i){ return t.lineup.indexOf(i) < 0; }); };
// Team strength: lineup average mode effectiveness + chemistry
DY.chem = function(t){
  var P = G().P, ids = t.lineup.length ? t.lineup : t.roster; if (!ids.length) return 0;
  var ps = ids.map(function(i){ return P[i]; });
  var c = (mean(ps.map(function(p){ return p.chem; })) - 65) / 20 + (Math.max.apply(null, ps.map(function(p){ return p.lead; })) - 60) / 30 + (mean(ps.map(function(p){ return p.rel; })) - 55) / 40;
  var cont = mean(ps.map(function(p){ return Math.min(3, p.tenure || 0); })) * 0.25; // continuity: seasons together
  return clamp(c + cont, -2.5, 2.5);
};
DY.teamRating = function(t, ids){
  var P = G().P; ids = ids || (t.lineup.length ? t.lineup : DY.bestLineup(t.roster)); if (!ids || !ids.length) return 60;
  return mean(ids.map(function(i){ return P[i].ovr; })) - 3 * DY.offRole(ids) + DY.chem(t) * 0.6;
};
DY.modeRating = function(t, m){ var P = G().P, ids = t.lineup.length ? t.lineup : t.roster; return mean(ids.map(function(i){ return DY.modeEff(P[i], m); })); };

/* =====================================================================================
   FANTASY DRAFT
   ===================================================================================== */
DY.draftOwner = function(n){ var g = G(), rd = Math.floor(n / DY.NT), i = n % DY.NT; return rd % 2 === 0 ? g.draft.order[i] : g.draft.order[DY.NT - 1 - i]; };
DY.draftTotal = function(){ return DY.NT * DY.ROSTER; };
DY.draftPool = function(){ var g = G(); return DY.active().filter(function(p){ return p.team == null && !g.draft.taken[p.id]; }); };
function canTake(ids, p, total){
  var c = DY.roleCounts(ids.concat([p.id])), n = ids.length + 1;
  return Math.max(0, Math.max(0, 2 - c.ar) + Math.max(0, 2 - c.smg) - c.fx) <= total - n;
}
DY.canDraft = function(tid, p){ return canTake(G().teams[tid].roster, p, DY.ROSTER); };
function aiDraftValue(t, p){
  var v = p.ovr + gauss() * 1.4, young = p.age <= 23 ? (p.ceil - p.ovr) * 0.3 : 0;
  if (t.style === "youth") v += young * 1.6 - Math.max(0, p.age - 28) * 0.5; else if (t.style === "stars") v += Math.max(0, p.ovr - 88) * 0.4; else v += young * 0.8;
  if (p.age >= 31) v -= 1.2;
  return v;
}
DY.draftAI = function(){
  var g = G(); g.draft.taken = g.draft.taken || {};
  while (g.draft.n < DY.draftTotal()){
    var tid = DY.draftOwner(g.draft.n), t = g.teams[tid];
    if (t.user) return false;
    var best = null, bv = -1e9;
    DY.draftPool().forEach(function(p){ if (!canTake(t.roster, p, DY.ROSTER)) return; var v = aiDraftValue(t, p); if (v > bv){ bv = v; best = p; } });
    draftTo(t, best);
  }
  return true;
};
function draftTo(t, p){ var g = G(); g.draft.taken = g.draft.taken || {}; g.draft.taken[p.id] = 1; t.roster.push(p.id); p.team = t.id; p.status = "main"; g.draft.picks.push({n:g.draft.n, t:t.id, p:p.id}); g.draft.n++; }
DY.draftUser = function(pid){
  var g = G(), tid = DY.draftOwner(g.draft.n), t = g.teams[tid], p = g.P[pid];
  if (!t.user || !p || p.team != null) return "Not your pick.";
  if (!canTake(t.roster, p, DY.ROSTER)) return "You need at least 2 ARs and 2 SMGs.";
  draftTo(t, p); DY.draftAI(); return null;
};
DY.draftAutoUser = function(){ var g = G(), t = DY.userT(), best = null, bv = -1e9; DY.draftPool().forEach(function(p){ if (!canTake(t.roster, p, DY.ROSTER)) return; var v = p.ovr + (p.age <= 23 ? (p.ceil - p.ovr) * 0.2 : 0); if (v > bv){ bv = v; best = p; } }); return best; };

/* After the draft: auto contracts (1 + team option, priced by value), equal budgets, academy draft, schedule. */
DY.finishDraft = function(){
  var g = G();
  g.teams.forEach(function(t){
    t.roster.forEach(function(id){ var p = g.P[id]; p.con = {sal:DY.salaryFor(p.ovr + Math.min(2, (p.rep || 0) * 0.25)), yrs:1, type:"1+1T", opt:true, signed:1, by:t.id}; p.rel = clamp(58 + p.pri.loyal * 20 + gauss() * 6, 30, 85); p.tenure = 0; p.joined = 1; DY.addLog(p, "Drafted by " + t.name + " in the fantasy draft (pick " + (g.draft.picks.find(function(x){ return x.p === id; }).n + 1) + ").");});
    DY.fixLineup(t);
  });
  var maxPay = Math.max.apply(null, g.teams.map(function(t){ return DY.payroll(t); }));
  var b0 = Math.max(DY.START_BUDGET, Math.ceil((maxPay + 60) / 50) * 50);
  g.teams.forEach(function(t){ t.budget = b0; });
  g.startBudget = b0;
  DY.academyDraft();
  DY.setTags(true);
  DY.newSeasonSetup();
  DY.active().forEach(function(p){ p.ovrH.push({s:1, o:Math.round(p.ovr)}); });
  g.phase = "preseason";
  DY.news("draft", "Draft grades are in", DY.draftGradesText(), {});
};
DY.draftGradesText = function(){
  var g = G(), rk = g.teams.slice().sort(function(a, b){ return DY.teamRating(b) - DY.teamRating(a); });
  var top = rk[0], bot = rk[rk.length - 1], u = DY.userT(), ur = rk.indexOf(u) + 1;
  return "On paper, " + top.name + " walked out of that room as the team to beat. " + bot.name + "? I have questions. A LOT of questions. " + u.name + " lands at #" + ur + " in my preseason rankings" + (ur <= 4 ? " — and that is a CONTENDER, ladies and gentlemen." : ur >= 13 ? ". I'm not saying it's over before it starts... but I'm not NOT saying it." : ". Middle of the pack. Prove me wrong.");
};

/* =====================================================================================
   ACADEMY (minor league): auto-draft everyone not on a main roster into teams of 4
   ===================================================================================== */
DY.academyDraft = function(){
  var g = G(), pool = DY.active().filter(function(p){ return p.team == null; });
  var n = Math.floor(pool.length / 4); if (n % 2 === 1 && n > 1) n--; n = Math.max(2, n);
  var used = {}; g.teams.forEach(function(t){ used[t.city.toLowerCase()] = 1; });
  var keep = g.minors.slice(0, n), names = keep.map(function(m){ return m.name; });
  var cand = shuffle(DY.ACADEMY.filter(function(x){ var lx = x.toLowerCase(); return names.indexOf(x) < 0 && !Object.keys(used).some(function(c){ return lx.indexOf(c + " ") === 0; }); }));
  while (keep.length < n){ var nm = cand.shift() || (pick(["Lakeside","Riverside","Mountain","Harbor","Prairie","Canyon","Coastal","Midland"]) + " " + pick(["Hawks","Vipers","Wolves","Rockets","Hornets","Pilots","Comets","Rangers"])); keep.push({id:keep.length, name:nm, abbr:nm.split(" ").map(function(w){ return w[0]; }).join("").slice(0, 3).toUpperCase(), roster:[], hist:[]}); }
  keep.forEach(function(m, i){ m.id = i; m.roster = []; m.w = 0; m.l = 0; m.mw = 0; m.ml = 0; });
  g.minors = keep;
  pool.forEach(function(p){ p.minor = null; if (p.status !== "retired") p.status = "fa"; });
  // snake by (visible-ish) strength with noise, keep role balance where possible
  var sorted = pool.slice().sort(function(a, b){ return (b.ovr + gauss() * 2) - (a.ovr + gauss() * 2); });
  for (var rd = 0; rd < 4; rd++){
    var order = rd % 2 === 0 ? keep : keep.slice().reverse();
    order.forEach(function(m){
      var c = DY.roleCounts(m.roster), wantRole = (c.ar < 2 && c.smg >= 2) ? "AR" : (c.smg < 2 && c.ar >= 2) ? "SMG" : null;
      var idx = sorted.findIndex(function(p){ return !wantRole || p.role === wantRole || p.flex != null; }); if (idx < 0) idx = 0;
      var p = sorted.splice(idx, 1)[0]; if (!p) return; m.roster.push(p.id); p.minor = m.id;
    });
  }
};

/* =====================================================================================
   SEASON SETUP: schedule (3 pool games + 7 cross-pool games = 10), form, stats buckets
   ===================================================================================== */
DY.newSeasonSetup = function(){
  var g = G(), ids = {N:[], E:[], S:[], W:[]};
  g.teams.forEach(function(t){ ids[t.pool].push(t.id); t.w = t.l = t.mw = t.ml = 0; t.h2h = {}; t.streak = 0; t.wk = []; t.mrec = {s:{}}; });
  // order each pool by last season's finish (Season 1: preseason strength). Same-place teams meet across pools (NFL style): top teams play top teams.
  var last = g.hist.length ? g.hist[g.hist.length - 1].stand : null, placeOf = {};
  if (last) last.forEach(function(r){ placeOf[r.id] = r.place; });
  DY.POOLS.forEach(function(k){ ids[k] = ids[k].sort(function(x, y){ return last ? (placeOf[x] || 9) - (placeOf[y] || 9) : DY.teamRating(g.teams[y], DY.bestLineup(g.teams[y].roster)) - DY.teamRating(g.teams[x], DY.bestLineup(g.teams[x].roster)); }); });
  var rounds = [];
  [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].forEach(function(rp){ var r = []; DY.POOLS.forEach(function(k){ rp.forEach(function(pr){ r.push([ids[k][pr[0]], ids[k][pr[1]]]); }); }); rounds.push({pool:true, pairs:r}); });
  var place = [[["N", "E"], ["S", "W"]], [["N", "S"], ["E", "W"]], [["N", "W"], ["E", "S"]]].map(function(pp){ var r = []; for (var i = 0; i < 4; i++) pp.forEach(function(x){ r.push([ids[x[0]][i], ids[x[1]][i]]); }); return {pool:false, place:true, pairs:r}; });
  var cross = [];
  [[["N", "S"], ["E", "W"]], [["N", "E"], ["S", "W"]], [["N", "W"], ["E", "S"]]].forEach(function(pp){
    for (var s = 1; s < 4; s++){ var r = []; pp.forEach(function(x){ for (var i = 0; i < 4; i++) r.push([ids[x[0]][i], ids[x[1]][(i + s) % 4]]); }); cross.push({pool:false, pairs:r}); }
  });
  cross = shuffle(cross).slice(0, 4); place = shuffle(place);
  var order = [cross[0], rounds[0], place[0], cross[1], rounds[1], place[1], cross[2], place[2], cross[3], rounds[2]];
  g.sched = order.map(function(r){ return {pool:r.pool, place:!!r.place, pairs:shuffle(r.pairs).map(function(p){ return chance(.5) ? p : [p[1], p[0]]; })}; });
  g.camp = []; g.round = 0; g.week = 1; g.res = []; g.mres = []; g.po = null; g.mpo = null; g.awards = null; g.offers = []; g.ext = {}; g.weekLog = [];
  // academy schedule (circle method)
  var mids = g.minors.map(function(m){ return m.id; }); if (mids.length % 2) mids.push(-1);
  var n = mids.length, ms = [];
  for (var r = 0; r < DY.ROUNDS; r++){
    var k = r % (n - 1), arr = [mids[0]].concat(mids.slice(1).slice(-k).concat(mids.slice(1).slice(0, n - 1 - k))).slice(0, n), prs = [];
    if (k === 0) arr = mids.slice();
    for (var i = 0; i < n / 2; i++){ var a = arr[i], b = arr[n - 1 - i]; if (a >= 0 && b >= 0) prs.push([a, b]); }
    ms.push(prs);
  }
  g.msched = ms;
  // players: season stat buckets, season form (some guys just have an off year), weekly heat
  DY.active().forEach(function(p){
    p.st = {reg:DY.newStats(), po:DY.newStats(), mi:DY.newStats()};
    var sd = 0.6 + (100 - p.cons) / 22; p.form = clamp(gauss() * sd, -5, 5); p.hot = 0; p.preOvr = p.ovr; p.trq = p.trq || 0;
    p.seasonTeam = p.team; p.seasonMinor = p.minor;
    if (p.team != null) p.tenure = (p.tenure || 0);
  });
  g.teams.forEach(function(t){ DY.fixLineup(t); t.pre = DY.teamRating(t); });
  g.pr = DY.powerRank();
};

/* =====================================================================================
   MATCH ENGINE
   ===================================================================================== */
var BASEK = {HP:23, CTL:18.5};
var WINV = {HP:0.0186, SND:0.0483, CTL:0.0235};
// how often each map comes up (real Seasons 5-6 map pool)
DY.MAP_W = {HP:{Raid:70, Checkmate:63, Garrison:16, Moscow:14, Apocalypse:10}, SND:{Standoff:52, Raid:45, Express:18, Moscow:12, Miami:5}, CTL:{Raid:60, Checkmate:38, Garrison:6}};
DY.FINALS = {W7:1, L10:1, GF:1, GF2:1};
function splitInt(total, w){ var s = sum(w) || 1, raw = w.map(function(x){ return total * x / s; }), out = raw.map(Math.floor), rem = Math.round(total) - sum(out); raw.map(function(r, i){ return [r - out[i], i]; }).sort(function(a, b){ return b[0] - a[0]; }).forEach(function(x){ if (rem > 0){ out[x[1]]++; rem--; } }); return out; }
function moodEff(p){ return p.form + p.hot + (p.rel - 55) / 45 + (p.trq ? -0.8 : 0); }
function sideEff(side, m, map){ return mean(side.ps.map(function(p){ return DY.modeEff(p, m) + moodEff(p) + DY.mapAff(p, m, map) * 0.8; })) + side.chem - 3 * side.off; }
DY.rollLineup = function(t, playoffs, finals){
  var g = G(), ids = t.lineup.slice(), sub = DY.sub(t), notes = [];
  if (sub != null && !finals) for (var k = 0; k < ids.length; k++){ var p = g.P[ids[k]]; if (chance(p.avail * (playoffs ? 0.25 : 1))){ notes.push({out:ids[k], inn:sub}); ids[k] = sub; break; } }
  return {ids:ids, notes:notes};
};
function pickMap(mode, used){ var w = DY.MAP_W[mode], opts = Object.keys(w).filter(function(m){ return !used[mode + m]; }); if (!opts.length) opts = Object.keys(w); return wpick(opts, function(m){ return w[m]; }); }
function recInc(o, k, won){ var r = o[k] || (o[k] = [0, 0]); r[won ? 0 : 1]++; }
// One best-of-5 series. bucket: "reg" | "po" | "mi". ctx: {ta, tb} team objects (main league) for map/mode records.
DY.simSeries = function(A, B, bucket, detail, bo, ctx){
  var g = G(); bo = bo || 5; var need = Math.ceil(bo / 2); ctx = ctx || {};
  var mk = function(s){ return {ps:s.ids.map(function(i){ return g.P[i]; }), chem:s.chem || 0, off:DY.offRole(s.ids)}; };
  var a = mk(A), b = mk(B), fa = gauss() * 1.1, fb = gauss() * 1.1, wa = 0, wb = 0, maps = [], used = {}, tot = {};
  a.ps.concat(b.ps).forEach(function(p){ tot[p.id] = {k:0, d:0, war:0, m:0}; });
  while (wa < need && wb < need){
    var mode = DY.SERIES_MODES[maps.length % 5], mp = pickMap(mode, used); used[mode + mp] = 1;
    var diff = sideEff(a, mode, mp) - sideEff(b, mode, mp) + fa - fb + (maps.length >= 4 ? (mean(a.ps.map(function(p){ return p.clutch; })) - mean(b.ps.map(function(p){ return p.clutch; }))) / 25 : 0);
    var p = 1 / (1 + Math.exp(-diff / 5.2));
    var mres = playMap(a, b, mode, p, mp, detail);
    mres.aw ? wa++ : wb++;
    [[a, mres.la], [b, mres.lb]].forEach(function(x){ x[0].ps.forEach(function(pl, i){ var L = x[1][i], s = pl.st && pl.st[bucket]; addLine(s, mode, L); var T = tot[pl.id]; T.k += L.k; T.d += L.d; T.war += L.war; T.m++; }); });
    if (ctx.ta && ctx.tb){ [[ctx.ta, mres.aw], [ctx.tb, !mres.aw]].forEach(function(x){ var t = x[0]; t.mrec = t.mrec || {}; t.mrec.s = t.mrec.s || {}; recInc(t.mrec.s, mode, x[1]); recInc(t.mrec.s, mode + "|" + mp, x[1]); }); }
    if (detail) maps.push({mode:mode, map:mp, sc:mres.sc, aw:mres.aw, la:mres.la.map(lineOut), lb:mres.lb.map(lineOut), ev:mres.ev, p:Math.round(p * 100)});
    else maps.push({mode:mode, map:mp, sc:mres.sc, aw:mres.aw});
  }
  var fin = function(side, won){ side.ps.forEach(function(p){ var s = p.st && p.st[bucket]; if (s){ s[won ? "sw" : "sl"]++; s.best = Math.max(s.best || 0, tot[p.id].k); } if (bucket !== "mi" && p.st){ var T = tot[p.id]; p.recent = (p.recent || []).concat([[T.k, T.d, Math.round(T.war * 100) / 100, T.m]]).slice(-6); } }); };
  fin(a, wa > wb); fin(b, wb > wa);
  if (ctx.ta && ctx.tb && bucket !== "mi") DY.trackRivalry(ctx.ta, ctx.tb, a.ps, b.ps, wa, wb, tot, bucket === "po", ctx.stage);
  return {wa:wa, wb:wb, maps:maps, ia:A.ids.slice(), ib:B.ids.slice(), tot:tot};
};
function lineOut(L){ return [L.id, L.k, L.d, L.o1, L.o2, L.o3, Math.round(L.war * 100) / 100]; }
function addLine(s, mode, L){
  if (!s) return;
  s.m++; s.k += L.k; s.d += L.d; s.war += L.war;
  if (mode === "HP"){ s.hm++; s.hk += L.k; s.hd += L.d; s.hill += L.o1; }
  else if (mode === "SND"){ s.sm++; s.sk += L.k; s.sd += L.d; s.pl += L.o1; s.df += L.o2; s.fb += L.o3; s.fd += L.fd || 0; }
  else { s.cm++; s.ck += L.k; s.cd += L.d; s.ok += L.o1; }
}
// K/D spread calibrated to real BTL: a season K/D of 1.40+ is rare
function killWeights(ps, dir, mode, map){ return ps.map(function(p){ var sk = mode === "SND" ? p.at.snd * 0.5 + p.at.gun * 0.5 : mode === "HP" ? p.at.hp * 0.4 + p.at.gun * 0.6 : p.at.ctl * 0.4 + p.at.gun * 0.6;
  sk += DY.mapAff(p, mode, map) + p.form + p.hot;
  var g = Math.exp((sk - 78) / (dir > 0 ? 92 : -92)), e = 0.8 + p.entry / 250; return g * e * rr(0.74, 1.26); }); }
var nm = function(p){ return p.n; };
function playMap(a, b, mode, p, map, detail){
  var la = a.ps.map(function(pl){ return {id:pl.id, k:0, d:0, o1:0, o2:0, o3:0, fd:0, war:0}; }), lb = b.ps.map(function(pl){ return {id:pl.id, k:0, d:0, o1:0, o2:0, o3:0, fd:0, war:0}; });
  var aw, sc, KA, KB, ev = detail ? [] : null, rounds = [];
  var pace = clamp(mean(a.ps.concat(b.ps).map(function(x){ return x.entry; })) / 50, 0.88, 1.15);
  if (mode === "SND"){
    var q = clamp(0.5 + (p - 0.5) * 0.55, 0.06, 0.94), ra = 0, rb = 0, rd = 0;
    while (ra < 6 && rb < 6){
      var aAtk = rd % 2 === 0, qq = clamp(q + (aAtk ? -0.03 : 0.03), 0.03, 0.97), aRound = rnd() < qq;
      aRound ? ra++ : rb++;
      var fbA = rnd() < (aRound ? 0.7 : 0.3), FB = fbA ? a : b, FD = fbA ? b : a, LF = fbA ? la : lb, LD = fbA ? lb : la;
      var fbp = wpick(FB.ps, function(x){ return x.entry * Math.exp((x.at.gun - 78) / 15); }), fdp = wpick(FD.ps, function(x){ return x.entry / Math.exp((x.at.gun - 78) / 20); });
      LF[FB.ps.indexOf(fbp)].o3++; LD[FD.ps.indexOf(fdp)].fd++;
      var atk = aAtk ? a : b, def = aAtk ? b : a, LAtk = aAtk ? la : lb, LDef = aAtk ? lb : la, atkWon = aAtk ? aRound : !aRound;
      var planted = rnd() < (atkWon ? 0.52 : 0.3), planter = null, defuser = null;
      if (planted){ planter = wpick(atk.ps, function(x){ return Math.exp((x.at.obj - 75) / 14) * (x.role === "SMG" ? 1.25 : 1); }); LAtk[atk.ps.indexOf(planter)].o1++;
        if (!atkWon && rnd() < 0.62){ defuser = wpick(def.ps, function(x){ return Math.exp((x.at.obj - 75) / 14); }); LDef[def.ps.indexOf(defuser)].o2++; } }
      if (ev){
        var W = aRound ? a : b, side = aRound ? "a" : "b", txt = null, hl = false, r = rnd();
        if (r < 0.025){ var ace = wpick(W.ps, function(x){ return Math.exp((x.at.gun - 75) / 8); }); txt = ace.n + " gets the ACE"; hl = true; }
        else if (r < 0.15){ var cl = wpick(W.ps, function(x){ return Math.exp((x.clutch - 60) / 12) * Math.exp((x.at.snd - 78) / 12); }), n2 = wpick([1, 2, 2, 2, 3, 3, 4], function(){ return 1; }); txt = cl.n + " wins a 1v" + n2 + " clutch" + (n2 >= 3 ? "!" : ""); hl = n2 >= 2; }
        else if (defuser) txt = defuser.n + " gets the defuse";
        else if (planter && atkWon) txt = planter.n + " plants and they hold it down";
        else txt = fbp.n + " gets the first blood" + (fbA === aRound ? "" : ", but they lose the round");
        ev.push({r:rd + 1, s:[ra, rb], w:side, t:txt, hl:hl});
      }
      rd++;
    }
    aw = ra > rb; sc = [ra, rb];
    var nr = ra + rb, R = clamp(Math.exp((ra - rb) / 10) * (1 + gauss() * 0.05), 0.6, 1.7);
    var n = nr * 2.6 * pace; KA = Math.min(nr * 4, Math.round(n * Math.sqrt(R))); KB = Math.min(nr * 4, Math.round(n / Math.sqrt(R)));
  } else {
    aw = rnd() < p;
    if (mode === "HP"){ var los = Math.round(250 * clamp(0.6 + ((aw ? 1 - p : p) - 0.5) * 0.5 + gauss() * 0.13, 0.22, 0.98)); sc = aw ? [250, los] : [los, 250]; }
    else { var lw = rnd() < 0.5 + (0.5 - Math.abs(p - 0.5)) * 0.5 ? 2 : rnd() < 0.55 ? 1 : 0; sc = aw ? [3, lw] : [lw, 3]; }
    var R2 = clamp(Math.exp((p - 0.5) * 0.55) * (aw ? 1.06 : 0.95) * (1 + gauss() * 0.045), 0.72, 1.4);
    var n2 = 4 * BASEK[mode] * pace * (mode === "CTL" ? (sc[0] + sc[1]) / 4.2 : (sc[0] + sc[1]) / 430);
    KA = Math.round(n2 * Math.sqrt(R2)); KB = Math.round(n2 / Math.sqrt(R2));
  }
  var ka = splitInt(KA, killWeights(a.ps, 1, mode, map)), da = splitInt(KB, killWeights(a.ps, -1, mode, map)), kb = splitInt(KB, killWeights(b.ps, 1, mode, map)), db = splitInt(KA, killWeights(b.ps, -1, mode, map));
  la.forEach(function(L, i){ L.k = ka[i]; L.d = Math.max(mode === "SND" ? 0 : 3, da[i]); });
  lb.forEach(function(L, i){ L.k = kb[i]; L.d = Math.max(mode === "SND" ? 0 : 3, db[i]); });
  if (mode === "HP"){
    [[a, la, sc[0]], [b, lb, sc[1]]].forEach(function(x){ var hs = splitInt(x[2] * rr(0.95, 1.15), x[0].ps.map(function(pl){ return Math.exp((pl.at.obj - 72) / 11) * (pl.role === "SMG" ? 1.3 : 1) * rr(0.65, 1.35); })); x[1].forEach(function(L, i){ L.o1 = hs[i]; }); });
    if (ev) hpStory(a, b, la, lb, sc, ev);
  } else if (mode === "CTL"){
    [[a, la], [b, lb]].forEach(function(x){ x[1].forEach(function(L, i){ var pl = x[0].ps[i]; L.o1 = Math.round(L.k * clamp(0.6 + (pl.at.obj - 72) / 70 + gauss() * 0.07, 0.4, 0.97)); }); });
    if (ev) ctlStory(a, b, la, lb, sc, aw, ev);
  }
  [[a, la], [b, lb]].forEach(function(x){ x[1].forEach(function(L, i){ var pl = x[0].ps[i], smg = pl.role === "SMG";
    var net = smg ? L.k * 0.93 - L.d * 0.86 : L.k - L.d, w = net * WINV[mode];
    if (mode === "HP") w += (L.o1 - 62) * 0.0047 * 0.5; else if (mode === "SND") w += (L.o1 * 0.25 + L.o2 * 0.5) * 0.137; else w += (L.o1 - 12) * 0.25 * 0.0235;
    L.war = w + 0.05; }); });
  if (ev){ var all = la.map(function(L, i){ return {L:L, p:a.ps[i]}; }).concat(lb.map(function(L, i){ return {L:L, p:b.ps[i]}; })).sort(function(x, y){ return y.L.war - x.L.war; }); var top = all[0];
    ev.push({end:1, t:"Map MVP: " + top.p.n + " (" + top.L.k + "-" + top.L.d + (mode === "HP" ? ", " + top.L.o1 + "s hill" : mode === "CTL" ? ", " + top.L.o1 + " obj kills" : "") + ")"});
    var streak = wpick(all.slice(0, 4), function(x){ return x.L.k; }); if (mode !== "SND" && streak.L.k >= 24 && rnd() < 0.6) ev.splice(Math.max(0, ev.length - 2), 0, {t:streak.p.n + " goes on a " + rint(8, 13) + "-kill streak", hl:true, w:a.ps.indexOf(streak.p) >= 0 ? "a" : "b"}); }
  return {aw:aw, sc:sc, la:la, lb:lb, ev:ev};
}
// hill-by-hill story for Hardpoint (adds up to the final score)
function hpStory(a, b, la, lb, sc, ev){
  var H = clamp(Math.ceil((sc[0] + sc[1]) / 40), 7, 13), wa = [], wb = [];
  for (var i = 0; i < H; i++){ wa.push(Math.pow(rnd(), 1.4) + 0.08); wb.push(Math.pow(rnd(), 1.4) + 0.08); }
  var ha = splitInt(sc[0], wa), hb = splitInt(sc[1], wb), ca = 0, cb = 0, lead = 0, hillN = ["P1", "P2", "P3", "P4", "P5"];
  // a hill is 60 seconds: no hill can give out more than 60 points between both teams
  for (var guard = 0; guard < 200; guard++){ var over = -1; for (var hh = 0; hh < H; hh++) if (ha[hh] + hb[hh] > 60){ over = hh; break; } if (over < 0) break; var ex = ha[over] + hb[over] - 60, arr = ha[over] >= hb[over] ? ha : hb; var dest = rint(0, H - 1); if (ha[dest] + hb[dest] + ex <= 60){ arr[over] -= ex; arr[dest] += ex; } }
  var holder = function(side, L){ var ps = side.ps; return wpick(ps, function(x){ return L[ps.indexOf(x)].o1 + 1; }); };
  for (var h = 0; h < H; h++){
    // the winner must reach 250 on the last hill: keep totals under 250 until then
    ca += ha[h]; cb += hb[h];
    if (h < H - 1){ ca = Math.min(ca, 249); cb = Math.min(cb, 249); } else { ca = sc[0]; cb = sc[1]; }
    var big = ha[h] >= 42 ? "a" : hb[h] >= 42 ? "b" : null, nl = ca > cb ? 1 : ca < cb ? -1 : 0, t;
    if (big) t = holder(big === "a" ? a : b, big === "a" ? la : lb).n + " anchors hill " + (h + 1) + " (" + hillN[h % 5] + ") for +" + (big === "a" ? ha[h] : hb[h]);
    else if (nl && lead && nl !== lead) t = "Lead change on hill " + (h + 1);
    else t = "Hill " + (h + 1) + " (" + hillN[h % 5] + ") split " + ha[h] + "-" + hb[h];
    ev.push({r:h + 1, s:[ca, cb], w:ha[h] >= hb[h] ? "a" : "b", t:t, hl:!!big || (nl && lead && nl !== lead)});
    if (nl) lead = nl;
  }
}
function ctlStory(a, b, la, lb, sc, aw, ev){
  var seq = []; for (var i = 0; i < sc[0]; i++) seq.push("a"); for (var j = 0; j < sc[1]; j++) seq.push("b");
  var last = aw ? "a" : "b"; seq.splice(seq.lastIndexOf(last), 1); seq = shuffle(seq); seq.push(last);
  var ca = 0, cb = 0;
  seq.forEach(function(w, i){ w === "a" ? ca++ : cb++; var side = w === "a" ? a : b, L = w === "a" ? la : lb, star = wpick(side.ps, function(x){ return L[side.ps.indexOf(x)].o1 + 1; }), atk = i % 2 === 0;
    var t = rnd() < 0.5 ? star.n + (atk === (w === "a") ? " leads the push and they take both points" : " holds the point with " + rint(3, 6) + " objective kills") : (w === "a" ? "Round to " : "Round to ") + (w === "a" ? "the home side" : "the away side");
    if (t.indexOf("Round to") === 0) t = star.n + " and company win round " + (i + 1) + (rnd() < 0.3 ? " with one life left" : "");
    ev.push({r:i + 1, s:[ca, cb], w:w, t:t, hl:/one life/.test(t)}); });
}

/* season OVR from a stat line (BTL v3 scale: 78.6 + k x wins added per map, shrunk for small samples) */
DY.seasonOvr = function(s){ if (!s || !s.m) return null; var r = (s.war - 0.05 * s.m) / s.m, n = s.m, prior = -0.233 * Math.exp(-n / 5); r = prior + n / (n + 6) * (r - prior); return clamp(Math.round(78.6 + 118 * r), 45, 99); };
DY.kd = function(k, d){ return d ? k / d : k; };

/* =====================================================================================
   RIVALRIES: every series between two BTL teams, and every matchup between their players
   ===================================================================================== */
DY.rvRec = function(t, oid){ t.rv = t.rv || {}; return t.rv[oid] || (t.rv[oid] = {w:0, l:0, mw:0, ml:0, po:0, ko:0, kod:0, gf:0, last:0}); };
DY.trackRivalry = function(A, B, pa, pb, wa, wb, tot, po, stage){
  var g = G(), ra = DY.rvRec(A, B.id), rb = DY.rvRec(B, A.id), aw = wa > wb;
  ra[aw ? "w" : "l"]++; rb[aw ? "l" : "w"]++; ra.mw += wa; ra.ml += wb; rb.mw += wb; rb.ml += wa; ra.last = rb.last = g.season;
  if (po){ ra.po++; rb.po++; } if (stage === "gf"){ ra.gf++; rb.gf++; }
  var close = Math.abs(wa - wb) === 1;
  var one = function(p, q, won){ p.rv = p.rv || {}; var r = p.rv[q.id] || (p.rv[q.id] = [0, 0, 0, 0, 0, 0, 0]); // series, wins, my K, my D, his K, his D, playoff meetings
    var tp = tot[p.id], tq = tot[q.id]; r[0]++; if (won) r[1]++; r[2] += tp.k; r[3] += tp.d; r[4] += tq.k; r[5] += tq.d; if (po) r[6]++; if (close) r[0] += 0; };
  pa.forEach(function(p){ pb.forEach(function(q){ one(p, q, aw); one(q, p, !aw); }); });
};
DY.rvScore = function(r, sameP){ return r.w + r.l + r.po * 3 + r.ko * 4 + r.kod * 4 + r.gf * 6 + Math.max(0, 3 - Math.abs(r.w - r.l)) * 0.7 + (sameP ? 2 : 0); };
DY.teamRivals = function(t, n){ var g = G(); return Object.keys(t.rv || {}).map(function(id){ var r = t.rv[id], o = g.teams[id]; return {t:o, r:r, sc:DY.rvScore(r, o.pool === t.pool)}; }).filter(function(x){ return x.r.w + x.r.l >= 2; }).sort(function(a, b){ return b.sc - a.sc; }).slice(0, n || 3); };
DY.playerRivals = function(p, n){ var g = G(); return Object.keys(p.rv || {}).map(function(id){ var r = p.rv[id], q = g.P[id]; if (!q) return null; return {q:q, r:r, sc:r[0] + r[6] * 2.5 + Math.max(0, 2 - Math.abs(r[1] * 2 - r[0])) * 0.5 + (q.ovr >= 85 ? 1 : 0)}; }).filter(function(x){ return x && x.r[0] >= 2; }).sort(function(a, b){ return b.sc - a.sc; }).slice(0, n || 3); };
DY.pruneRivals = function(){ DY.allP().forEach(function(p){ if (!p.rv) return; var keep = DY.playerRivals(p, 15).map(function(x){ return String(x.q.id); }), o = {}; keep.forEach(function(k){ o[k] = p.rv[k]; }); p.rv = o; }); };

/* =====================================================================================
   REGULAR SEASON FLOW
   ===================================================================================== */
DY.userMatch = function(){ var g = G(); if (g.phase !== "season" || g.round >= DY.ROUNDS) return null; return g.sched[g.round].pairs.find(function(pr){ return pr.indexOf(g.user) >= 0; }); };
DY.playRound = function(){
  var g = G(); if (g.phase !== "season" || g.round >= DY.ROUNDS) return null;
  var rd = g.sched[g.round], out = null, bigs = [];
  g.teams.forEach(function(t){ DY.fixLineup(t); });
  rd.pairs.forEach(function(pr){
    var A = g.teams[pr[0]], B = g.teams[pr[1]], la = DY.rollLineup(A), lb = DY.rollLineup(B);
    la.chem = DY.chem(A); lb.chem = DY.chem(B);
    var user = A.user || B.user, pre = [[A.w, A.l], [B.w, B.l]], s = DY.simSeries(la, lb, "reg", user, 5, {ta:A, tb:B});
    var rec = {r:g.round, a:A.id, b:B.id, wa:s.wa, wb:s.wb, maps:s.maps.map(function(m){ return user ? m : [m.mode[0], m.sc[0], m.sc[1]]; }), sub:la.notes.concat(lb.notes), ia:s.ia, ib:s.ib, pool:rd.pool, pre:pre};
    if (user) rec.tot = s.tot;
    g.res.push(rec);
    applyResult(A, B, s.wa, s.wb);
    Object.keys(s.tot).forEach(function(id){ var T = s.tot[id]; bigs.push({id:+id, k:T.k, d:T.d, war:T.war, m:T.m, r:rec}); });
    rec.sub.forEach(function(n){ var o = g.P[n.out], i = g.P[n.inn]; g.weekLog.push({t:"sub", out:n.out, inn:n.inn, tm:(A.roster.indexOf(n.out) >= 0 ? A : B).id}); DY.addLog(o, "Missed a match vs " + (A.roster.indexOf(n.out) >= 0 ? B : A).name + " (scheduling conflict)."); });
    if (user) out = rec;
  });
  DY.playAcademyRound();
  g.weekLog.push({t:"bigs", list:bigs.sort(function(x, y){ return y.war - x.war; }).slice(0, 6).map(function(b){ return {id:b.id, k:b.k, d:b.d, war:b.war, a:b.r.a, b:b.r.b, wa:b.r.wa, wb:b.r.wb}; })});
  // heat: short streaks
  DY.active().forEach(function(p){ p.hot = clamp(p.hot * 0.6 + gauss() * 0.7, -2.5, 2.5); });
  g.round++;
  if (g.round % 2 === 0) DY.endWeek();
  return out;
};
function applyResult(A, B, wa, wb){
  A.mw += wa; A.ml += wb; B.mw += wb; B.ml += wa;
  var aw = wa > wb, W = aw ? A : B, L = aw ? B : A;
  W.w++; L.l++; W.h2h[L.id] = (W.h2h[L.id] || 0) + 1;
  W.streak = W.streak >= 0 ? W.streak + 1 : 1; L.streak = L.streak <= 0 ? L.streak - 1 : -1;
  W.wk.push("W"); L.wk.push("L");
  [W, L].forEach(function(t, i){ t.roster.forEach(function(id){ var p = G().P[id], starter = t.lineup.indexOf(id) >= 0; p.rel = clamp(p.rel + (i === 0 ? 0.9 : -0.8) * (0.5 + p.pri.win * 1.5) - (!starter ? 0.9 * (0.4 + p.pri.pt * 2) : 0), 0, 100); }); });
}
DY.playAcademyRound = function(){
  var g = G(), prs = g.msched[g.round] || [];
  // main-team subs get academy reps: each one slots into an academy lineup for this round
  var subs = g.teams.map(function(t){ return DY.sub(t); }).filter(function(x){ return x != null; });
  var mtLineups = {};
  g.minors.forEach(function(m){ mtLineups[m.id] = m.roster.slice(0, 4); });
  shuffle(subs).forEach(function(sid, i){ var m = g.minors[i % g.minors.length]; if (!m || mtLineups[m.id].length < 4) return; var k = rint(0, 3); mtLineups[m.id] = mtLineups[m.id].slice(); mtLineups[m.id][k] = sid; });
  prs.forEach(function(pr){
    var A = g.minors[pr[0]], B = g.minors[pr[1]]; if (!A || !B || mtLineups[A.id].length < 4 || mtLineups[B.id].length < 4) return;
    var s = DY.simSeries({ids:mtLineups[A.id], chem:0}, {ids:mtLineups[B.id], chem:0}, "mi", false);
    A.mw += s.wa; A.ml += s.wb; B.mw += s.wb; B.ml += s.wa; if (s.wa > s.wb){ A.w++; B.l++; } else { B.w++; A.l++; }
    g.mres.push({r:g.round, a:A.id, b:B.id, wa:s.wa, wb:s.wb});
  });
};
DY.poolStandings = function(pool){
  var g = G(), ts = g.teams.filter(function(t){ return t.pool === pool; });
  return ts.slice().sort(function(a, b){ return b.w - a.w || (b.mw - b.ml) - (a.mw - a.ml) || (b.h2h[a.id] || 0) - (a.h2h[b.id] || 0) || b.mw - a.mw || a.id - b.id; });
};
DY.leagueStandings = function(){ var g = G(); return g.teams.slice().sort(function(a, b){ return b.w - a.w || (b.mw - b.ml) - (a.mw - a.ml) || b.mw - a.mw; }); };
DY.powerRank = function(){
  var g = G();
  return g.teams.map(function(t){ var gp = t.w + t.l, wp = gp ? t.w / gp : 0.5, md = gp ? (t.mw - t.ml) / gp : 0; return {id:t.id, v:DY.teamRating(t) * 0.55 + (wp - 0.5) * 12 * Math.min(1, gp / 4) + md * 1.4 + (t.streak || 0) * 0.25}; }).sort(function(a, b){ return b.v - a.v; }).map(function(x){ return x.id; });
};

DY.endWeek = function(){
  var g = G(), prev = g.pr || [];
  g.pr = DY.powerRank();
  DY.weeklyNews(prev);
  DY.updateFans();
  if (g.round < DY.ROUNDS){
    g.week++;
    DY.weeklyMarket();
  } else {
    DY.endRegularSeason();
  }
  g.weekLog = [];
};

/* =====================================================================================
   END OF REGULAR SEASON -> PLAYOFFS (12 teams, CDL-major style double elimination)
   ===================================================================================== */
DY.PO_ORDER = ["W1","W2","W3","W4","L1","L2","L3","L4","W5","W6","L5","L6","L7","L8","W7","L9","L10","GF","GF2"];
DY.PO = {
  W1:{r:"Winners R1", a:["s",0], b:["s",7]}, W2:{r:"Winners R1", a:["s",3], b:["s",4]}, W3:{r:"Winners R1", a:["s",1], b:["s",6]}, W4:{r:"Winners R1", a:["s",2], b:["s",5]},
  L1:{r:"Elimination R1", a:["l","W1"], b:["s",11]}, L2:{r:"Elimination R1", a:["l","W2"], b:["s",10]}, L3:{r:"Elimination R1", a:["l","W3"], b:["s",9]}, L4:{r:"Elimination R1", a:["l","W4"], b:["s",8]},
  W5:{r:"Winners semifinal", a:["w","W1"], b:["w","W2"]}, W6:{r:"Winners semifinal", a:["w","W3"], b:["w","W4"]},
  L5:{r:"Elimination R2", a:["w","L1"], b:["w","L2"]}, L6:{r:"Elimination R2", a:["w","L3"], b:["w","L4"]},
  L7:{r:"Elimination R3", a:["w","L5"], b:["l","W6"]}, L8:{r:"Elimination R3", a:["w","L6"], b:["l","W5"]},
  W7:{r:"Winners final", a:["w","W5"], b:["w","W6"]}, L9:{r:"Elimination quarterfinal", a:["w","L7"], b:["w","L8"]},
  L10:{r:"Elimination final", a:["w","L9"], b:["l","W7"]}, GF:{r:"Grand final", a:["w","W7"], b:["w","L10"]}, GF2:{r:"Grand final reset", a:["w","L10"], b:["w","W7"]}
};
DY.endRegularSeason = function(){
  var g = G();
  var place = {}; DY.POOLS.forEach(function(k){ DY.poolStandings(k).forEach(function(t, i){ place[t.id] = i + 1; }); });
  var byPlace = function(n){ return g.teams.filter(function(t){ return place[t.id] === n; }).sort(function(a, b){ return b.w - a.w || (b.mw - b.ml) - (a.mw - a.ml) || b.mw - a.mw; }); };
  var firsts = byPlace(1), seconds = byPlace(2), thirds = byPlace(3);
  // pool winners are seeds 1-4, runners-up 5-8. Round 1 pairs a pool winner with a runner-up from ANOTHER pool, as close to 1v8, 2v7, 3v6, 4v5 as possible.
  var best = null, bc = 1e9;
  permute([0, 1, 2, 3]).forEach(function(pm){ var c = 0; for (var i = 0; i < 4; i++){ var opp = seconds[pm[i]]; if (opp.pool === firsts[i].pool) c += 100; c += Math.abs(pm[i] - (3 - i)); } if (c < bc){ bc = c; best = pm; } });
  var sec = [0, 1, 2, 3].map(function(i){ return seconds[best[i]]; });   // sec[i] meets firsts[i]
  // seeds array positions: 0..3 = firsts; 4..7 arranged so W1 = s0 v s7, W2 = s3 v s4, W3 = s1 v s6, W4 = s2 v s5
  var seeds = [firsts[0].id, firsts[1].id, firsts[2].id, firsts[3].id, sec[3].id, sec[2].id, sec[1].id, sec[0].id, thirds[0].id, thirds[1].id, thirds[2].id, thirds[3].id];
  g.po = {seeds:seeds, place:place, res:{}, idx:0, pseeds:{}};
  seeds.forEach(function(id, i){ g.po.pseeds[id] = i + 1; });
  g.phase = "playoffs"; g.offers = [];
  g.awards = DY.computeAwards();
  DY.applyAwards(g.awards, false);
  DY.academyPlayoffs();
  DY.playoffNews();
};
function permute(a){ if (a.length <= 1) return [a]; var out = []; a.forEach(function(x, i){ permute(a.slice(0, i).concat(a.slice(i + 1))).forEach(function(r){ out.push([x].concat(r)); }); }); return out; }
var winnerOf = function(r){ return r.wa > r.wb ? r.a : r.b; }, loserOf = function(r){ return r.wa > r.wb ? r.b : r.a; };
DY.winnerOf = winnerOf; DY.loserOf = loserOf;
DY.poRef = function(ref){ var g = G(); if (ref[0] === "s") return g.po.seeds[ref[1]]; var r = g.po.res[ref[1]]; if (!r) return null; return ref[0] === "w" ? winnerOf(r) : loserOf(r); };
DY.poOrder = function(){ var g = G(), gf = g.po && g.po.res.GF; return gf && winnerOf(gf) === DY.poRef(DY.PO.GF.b) ? DY.PO_ORDER : DY.PO_ORDER.slice(0, -1); };
DY.poNext = function(){ var g = G(); if (!g.po) return null; var ord = DY.poOrder(); return g.po.idx < ord.length ? ord[g.po.idx] : null; };
DY.userAlive = function(){ var g = G(), u = g.user; if (!g.po || !DY.poNext()) return false; var si = g.po.seeds.indexOf(u); if (si < 0) return false; var losses = 0; DY.poOrder().forEach(function(id){ var r = g.po.res[id]; if (r && loserOf(r) === u) losses++; }); return losses < (si >= 8 ? 1 : 2); };
DY.playPlayoff = function(){
  var g = G(), id = DY.poNext(); if (!id) return null;
  var M = DY.PO[id], a = DY.poRef(M.a), b = DY.poRef(M.b), A = g.teams[a], B = g.teams[b];
  DY.fixLineup(A); DY.fixLineup(B);
  var finals = !!DY.FINALS[id], la = DY.rollLineup(A, true, finals), lb = DY.rollLineup(B, true, finals); la.chem = DY.chem(A); lb.chem = DY.chem(B);
  var user = A.user || B.user, s = DY.simSeries(la, lb, "po", true, 5, {ta:A, tb:B, stage:/GF/.test(id) ? "gf" : DY.FINALS[id] ? "final" : "po"});
  var rec = {id:id, a:a, b:b, wa:s.wa, wb:s.wb, maps:s.maps, tot:s.tot, ia:s.ia, ib:s.ib, sub:la.notes.concat(lb.notes), pre:[[A.w, A.l], [B.w, B.l]]};
  if (!user && !/GF|L10|W7/.test(id)) rec.maps = s.maps.map(function(m){ return {mode:m.mode, map:m.map, sc:m.sc, aw:m.aw}; }); else if (!user) rec.maps.forEach(function(m){ delete m.ev; });
  g.po.res[id] = rec; g.po.idx++;
  (function(){ var w = s.wa > s.wb ? A : B, l = s.wa > s.wb ? B : A, si = g.po.seeds.indexOf(l.id), losses = 0; DY.poOrder().forEach(function(k){ var r = g.po.res[k]; if (r && loserOf(r) === l.id) losses++; }); if (losses >= (si >= 8 ? 1 : 2) || id === "GF2" || (id === "GF" && l.id === DY.poRef(DY.PO.GF.b))){ var r1 = DY.rvRec(w, l.id), r2 = DY.rvRec(l, w.id); r1.ko++; r2.kod++; rec.elim = l.id; } })();
  DY.playoffResultNews(id, rec);
  if (!DY.poNext()) DY.finishPlayoffs();
  return rec;
};
DY.finishPlayoffs = function(){
  var g = G(), final = g.po.res.GF2 || g.po.res.GF, champ = winnerOf(final), ru = loserOf(final);
  g.po.champ = champ; g.po.ru = ru;
  // finishes
  var fin = {}; fin[champ] = 1; fin[ru] = 2;
  var lf = {L10:3, L9:4, L7:5, L8:5, L5:7, L6:7, L1:9, L2:9, L3:9, L4:9};
  Object.keys(lf).forEach(function(k){ var r = g.po.res[k]; if (r) fin[loserOf(r)] = lf[k]; });
  g.teams.forEach(function(t){ if (!fin[t.id]) fin[t.id] = 13; });
  g.po.fin = fin;
  // Finals MVP: best WAR+ on the champion across the playoffs
  var ch = g.teams[champ], fm = ch.roster.map(function(id){ return g.P[id]; }).filter(function(p){ return p.st.po.m > 0; }).sort(function(a, b){ return b.st.po.war - a.st.po.war; })[0];
  g.awards.fmvp = fm ? fm.id : null;
  DY.applyAwards(g.awards, true);
  DY.championNews();
  DY.beginOffseason();
};
DY.academyPlayoffs = function(){
  var g = G(), st = g.minors.slice().sort(function(a, b){ return b.w - a.w || (b.mw - b.ml) - (a.mw - a.ml); }).slice(0, 4);
  if (st.length < 4) { g.mpo = null; return; }
  var play = function(A, B){ var s = DY.simSeries({ids:A.roster.slice(0, 4)}, {ids:B.roster.slice(0, 4)}, "mi", false); return {a:A.id, b:B.id, wa:s.wa, wb:s.wb}; };
  var s1 = play(st[0], st[3]), s2 = play(st[1], st[2]), f = play(g.minors[winnerOf(s1)], g.minors[winnerOf(s2)]);
  g.mpo = {semis:[s1, s2], final:f, champ:winnerOf(f), seeds:st.map(function(m){ return m.id; })};
};

/* =====================================================================================
   AWARDS
   ===================================================================================== */
DY.computeAwards = function(){
  var g = G(), teamMaps = {};
  g.teams.forEach(function(t){ teamMaps[t.id] = t.mw + t.ml; });
  var rows = DY.active().filter(function(p){ return p.team != null && p.st && p.st.reg.m > 0; }).map(function(p){
    var s = p.st.reg, t = g.teams[p.team], wp = t.w / Math.max(1, t.w + t.l);
    return {p:p, s:s, so:DY.seasonOvr(s), wp:wp, q:s.m >= 0.5 * (teamMaps[p.team] || 1), score:s.war + 2.2 * (wp - 0.5) + (s.m / Math.max(1, teamMaps[p.team])) * 0.8};
  });
  var q = rows.filter(function(r){ return r.q; }).sort(function(a, b){ return b.score - a.score; });
  var A = {s:g.season, mvp:q[0] ? q[0].p.id : null, as1:[], as2:[], roy:null, mip:null, sb:null, amvp:null, fmvp:null};
  var used = {}; if (A.mvp != null) {}
  ["as1", "as2"].forEach(function(k){ var need = {AR:2, SMG:2}; q.forEach(function(r){ if (used[r.p.id]) return; var role = r.p.role; if (need[role] > 0){ need[role]--; used[r.p.id] = 1; A[k].push(r.p.id); } }); });
  var rook = q.filter(function(r){ return r.p.rookieSeason === g.season; }).sort(function(a, b){ return b.score - a.score; })[0]; A.roy = rook ? rook.p.id : null;
  var mip = q.filter(function(r){ return r.p.lastSO != null && r.p.rookieSeason !== g.season; }).map(function(r){ return {p:r.p, d:(r.so - r.p.lastSO) * 0.6 + (r.p.ovr - (r.p.ovrH.length >= 2 ? r.p.ovrH[r.p.ovrH.length - 2].o : r.p.ovr)) * 1.0}; }).sort(function(a, b){ return b.d - a.d; })[0];
  A.mip = mip && mip.d > 2 ? mip.p.id : null;
  var sb = q.slice().sort(function(a, b){ return a.so - b.so; })[0]; A.sb = sb ? sb.p.id : null;
  var mi = DY.active().filter(function(p){ return p.st && p.st.mi.m >= 12 && p.team == null; }).sort(function(a, b){ return b.st.mi.war - a.st.mi.war; })[0]; A.amvp = mi ? mi.id : null;
  // best in each mode (for the record books)
  var modeBest = function(km, kk, kd, min){ var r = q.filter(function(x){ return x.s[km] >= min; }).sort(function(a, b){ return DY.kd(b.s[kk], b.s[kd]) - DY.kd(a.s[kk], a.s[kd]); })[0]; return r ? r.p.id : null; };
  A.bestHP = modeBest("hm", "hk", "hd", 6); A.bestSND = modeBest("sm", "sk", "sd", 5); A.bestCTL = modeBest("cm", "ck", "cd", 3);
  return A;
};
DY.ACC_NAME = {MVP:"League MVP", FMVP:"Finals MVP", CHAMP:"Champion", RU:"Runner-up", AS1:"All-Star 1st Team", AS2:"All-Star 2nd Team", ROY:"Rookie of the Year", MIP:"Most Improved Player", SB:"Super Burger", AMVP:"Academy MVP", ACHAMP:"Academy Champion"};
DY.giveAcc = function(id, a){ var p = G().P[id]; if (!p) return; if (p.acc.some(function(x){ return x.s === G().season && x.a === a; })) return; p.acc.push({s:G().season, a:a, t:p.team != null ? G().teams[p.team].abbr : null}); DY.addLog(p, DY.ACC_NAME[a] + " (Season " + G().season + ")."); };
DY.applyAwards = function(A, final){
  var g = G();
  if (!final){
    if (A.mvp != null) DY.giveAcc(A.mvp, "MVP");
    A.as1.forEach(function(id){ DY.giveAcc(id, "AS1"); }); A.as2.forEach(function(id){ DY.giveAcc(id, "AS2"); });
    if (A.roy != null) DY.giveAcc(A.roy, "ROY"); if (A.mip != null) DY.giveAcc(A.mip, "MIP"); if (A.sb != null) DY.giveAcc(A.sb, "SB"); if (A.amvp != null) DY.giveAcc(A.amvp, "AMVP");
    if (g.mpo) g.minors[g.mpo.champ].roster.forEach(function(id){ DY.giveAcc(id, "ACHAMP"); });
  } else {
    if (A.fmvp != null) DY.giveAcc(A.fmvp, "FMVP");
    g.teams[g.po.champ].roster.forEach(function(id){ DY.giveAcc(id, "CHAMP"); });
    g.teams[g.po.ru].roster.forEach(function(id){ DY.giveAcc(id, "RU"); });
  }
};
})(typeof window !== "undefined" ? window : globalThis);
