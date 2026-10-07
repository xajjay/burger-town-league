/* DYNASTY: offseason — season archive, retirements, progression (boom/bust), rookie classes, options, 3-week free agency, legacy, Hall of Fame. */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, rint = DY.rint, rr = DY.rr, pick = DY.pick, shuffle = DY.shuffle, chance = DY.chance, wpick = DY.wpick, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };

/* =====================================================================================
   SEASON ARCHIVE -> OFFSEASON
   ===================================================================================== */
DY.beginOffseason = function(){
  var g = G(), s = g.season, place = g.po.place;
  // league history row
  var stand = g.teams.map(function(t){ return {id:t.id, w:t.w, l:t.l, mw:t.mw, ml:t.ml, pool:t.pool, place:place[t.id], fin:g.po.fin[t.id], seed:g.po.pseeds[t.id] || null}; });
  g.hist.push({s:s, champ:g.po.champ, ru:g.po.ru, champName:g.teams[g.po.champ].name, ruName:g.teams[g.po.ru].name, aw:JSON.parse(JSON.stringify(g.awards)), stand:stand,
    gf:{a:(g.po.res.GF2 || g.po.res.GF).a, b:(g.po.res.GF2 || g.po.res.GF).b, wa:(g.po.res.GF2 || g.po.res.GF).wa, wb:(g.po.res.GF2 || g.po.res.GF).wb, reset:!!g.po.res.GF2},
    acad:g.mpo ? {champ:g.minors[g.mpo.champ].name} : null, champRoster:g.teams[g.po.champ].roster.slice()});
  g.teams.forEach(function(t){
    t.hist.push({s:s, w:t.w, l:t.l, mw:t.mw, ml:t.ml, place:place[t.id], pool:t.pool, fin:g.po.fin[t.id], tag:t.tag, roster:t.roster.slice(), budget:t.budget, eng:Math.round(t.fan.eng)});
    if (g.po.fin[t.id] === 1) t.titles = (t.titles || 0) + 1;
  });
  g.minors.forEach(function(m){ m.hist.push({s:s, w:m.w, l:m.l, champ:g.mpo && g.mpo.champ === m.id}); });
  // player career lines
  var fitPts = [];
  DY.active().forEach(function(p){
    if (!p.st) return;
    var reg = p.st.reg, po = p.st.po, mi = p.st.mi;
    if (!reg.m && !po.m && !mi.m) { p.car.push({s:s, tm:p.team != null ? g.teams[p.team].abbr : null, lvl:p.team != null ? "BTL" : "—", ovr:Math.round(p.preOvr || p.ovr), so:null}); return; }
    var lvl = reg.m ? "BTL" : "ACA", so = DY.seasonOvr(reg.m ? reg : mi);
    var tmA = reg.m ? (p.seasonTeam != null && p.seasonTeam !== p.team && p.team != null ? g.teams[p.seasonTeam].abbr + "/" + g.teams[p.team].abbr : p.team != null ? g.teams[p.team].abbr : p.seasonTeam != null ? g.teams[p.seasonTeam].abbr : "—") : (p.seasonMinor != null && g.minors[p.seasonMinor] ? g.minors[p.seasonMinor].abbr : "ACA");
    p.car.push({s:s, tm:tmA, lvl:lvl, ovr:Math.round(p.preOvr || p.ovr), so:so, reg:packS(reg), po:po.m ? packS(po) : null, mi:mi.m ? packS(mi) : null, fin:p.team != null ? g.po.fin[p.team] : null});
    p.lastSO = so;
    if (so != null) fitPts.push([p.preOvr || p.ovr, so, (reg.m || mi.m), p.id, lvl]);
  });
  // expectation fit: season OVR vs player OVR (performance residual feeds development)
  var xs = fitPts.filter(function(x){ return x[2] >= 8; }), mx = mean(xs.map(function(x){ return x[0]; })), my = mean(xs.map(function(x){ return x[1]; }));
  var b = sum(xs.map(function(x){ return (x[0] - mx) * (x[1] - my); })) / Math.max(1, sum(xs.map(function(x){ return (x[0] - mx) * (x[0] - mx); })));
  g.perfFit = {a:my - b * mx, b:b};
  fitPts.forEach(function(x){ var p = g.P[x[3]]; p.perf = clamp((x[1] - (g.perfFit.a + g.perfFit.b * x[0])) * x[2] / (x[2] + 10), -9, 9); });
  // tenure
  DY.pruneRivals();
  g.teams.forEach(function(t){ t.roster.forEach(function(id){ g.P[id].tenure = (g.P[id].tenure || 0) + 1; }); });
  DY.seasonEndFans();
  DY.applyExtensions();
  DY.allP().forEach(function(p){ p.legacy = DY.legacy(p); });
  g.off = {week:0, stage:"recap", retired:[], hof:[], prog:{}, opts:{}, rookies:[]};
  g.phase = "offseason";
  g.offers = [];
  // retirements, then everyone else develops
  DY.retirements();
  DY.progression();
  DY.hofInductions();
  DY.retireJerseys(g.off.retired);
  DY.trqOffseason();
  DY.contractsRollover();
  DY.bondsOffseason();
  DY.promoteClass();
  DY.setTags(false);
  DY.offseasonNews();
};
// career stat lines are stored as compact arrays (see DY.STK); DY.uS turns them back into objects
DY.STK = ["m","k","d","hm","hk","hd","sm","sk","sd","cm","ck","cd","hill","pl","df","fb","fd","ok","war","sw","sl","best"];
function packS(s){ var a = DY.STK.map(function(k){ return Math.round((s[k] || 0) * 100) / 100; }); while (a.length && !a[a.length - 1]) a.pop(); return a; }
DY.uS = function(a){ if (!a) return null; if (!Array.isArray(a)) return a; var o = {}; DY.STK.forEach(function(k, i){ o[k] = a[i] || 0; }); return o; };

/* =====================================================================================
   RETIREMENT
   ===================================================================================== */
DY.retireChance = function(p){
  var a = p.age, base = a < 28 ? 0.003 : a === 28 ? 0.01 : a === 29 ? 0.02 : a === 30 ? 0.04 : a === 31 ? 0.07 : a === 32 ? 0.11 : a === 33 ? 0.16 : a === 34 ? 0.23 : a === 35 ? 0.32 : 0.45;
  if (p.ovr < 72) base *= 2; else if (p.ovr > 88) base *= 0.5;
  if (p.team == null && a >= 25 && p.car.slice(-2).every(function(c){ return c.lvl !== "BTL"; }) && p.car.length >= 2) base += 0.12;
  if (G().season <= 2) base *= 0.5;      // early in a dynasty, retirements are rare
  if (a >= 37) base = 1;
  return clamp(base, 0, 1);
};
DY.retirements = function(){
  var g = G();
  DY.active().forEach(function(p){
    if (p.rookie && p.yrs <= 0) return;
    if (!chance(DY.retireChance(p))) return;
    var t = p.team != null ? g.teams[p.team] : null;
    if (t){ t.roster = t.roster.filter(function(i){ return i !== p.id; }); t.lineup = t.lineup.filter(function(i){ return i !== p.id; }); }
    if (p.minor != null && g.minors[p.minor]) g.minors[p.minor].roster = g.minors[p.minor].roster.filter(function(i){ return i !== p.id; });
    p.lastTeam = p.team != null ? g.teams[p.team].name : null;
    p.status = "retired"; p.team = null; p.minor = null; p.con = null; p.retiredS = g.season; p.legacy = DY.legacy(p);
    g.retiredIds.push(p.id); g.off.retired.push(p.id);
    DY.addLog(p, "Retired after Season " + g.season + ".");
  });
  g.off.retired.sort(function(a, b){ return g.P[b].legacy - g.P[a].legacy; });
};

/* =====================================================================================
   PROGRESSION — age curve + ceiling pull + performance + work ethic + noise + boom/bust events
   ===================================================================================== */
var GROW = [[19, .32], [20, .3], [21, .27], [22, .23], [23, .19], [24, .14], [25, .1], [26, .06], [99, .03]];
var DECL = [[26, 0], [27, .3], [28, .7], [29, 1.15], [30, 1.7], [31, 2.3], [32, 2.9], [33, 3.6], [99, 4.4]];
var lookup = function(tab, a){ for (var i = 0; i < tab.length; i++) if (a <= tab[i][0]) return tab[i][1]; return tab[tab.length - 1][1]; };
DY.develop = function(p){
  var a = p.age, ev = null;
  if (p.ovrAdj) { p.ovrAdj *= 0.85; DY.setOvr(p); }
  var old = p.ovr;
  var growth = Math.max(0, p.ceil - p.ovr) * lookup(GROW, a) * (p.ovr >= 92 ? 0.45 : p.ovr >= 88 ? 0.7 : 1), decl = lookup(DECL, a) * (1.15 - p.work / 260);
  var perf = (p.perf || 0) * (a <= 25 ? 0.22 : 0.14), work = (p.work - 65) / 30 * 0.7;
  var noise = gauss() * (0.8 + (100 - p.cons) / 70);
  var d = growth - decl + perf + work + noise;
  var r = rnd();
  if (a <= 23){ if (r < 0.06){ ev = "boom"; p.ceil += rr(3, 8); d += rr(2, 5); } else if (r < 0.11){ ev = "bust"; p.ceil -= rr(4, 9); d -= rr(1, 3.5); } }
  else if (a <= 28){ if (r < 0.025){ ev = "boom"; p.ceil += rr(2, 5); d += rr(2, 4); } else if (r < 0.055){ ev = "slump"; d -= rr(2, 4); } }
  else { if (r < 0.015){ ev = "renaissance"; d += rr(2, 4); } else if (r < 0.065){ ev = "cliff"; d -= rr(3, 6); p.ceil -= 3; } }
  d = clamp(d, -9, 10);
  // spread across skills (some guys jump in SnD, others in respawn)
  var keys = DY.ATTR, w = keys.map(function(){ return Math.max(0.1, 1 + gauss() * 0.45); }), ws = sum(w) / keys.length;
  keys.forEach(function(k, i){ p.at[k] = clamp(p.at[k] + d * w[i] / ws, 40, 99); });
  DY.setOvr(p);
  var shift = (old + d) - p.ovr; if (Math.abs(shift) > 0.05){ keys.forEach(function(k){ p.at[k] = clamp(p.at[k] + shift, 40, 99); }); DY.setOvr(p); }
  if (p.ovr > p.ceil) p.ceil = p.ovr;
  if (a >= 27) p.ceil = Math.max(p.ovr, p.ceil - Math.max(0, decl * 0.8));
  if (a <= 25 && (p.perf || 0) < -3) p.ceil -= rr(0.5, 2);
  p.ceil = clamp(p.ceil, p.ovr, 99.4);
  // potential is a forecast: past the prime it points down even if he is still very good
  var fc = a >= 28 ? p.ovr - (a - 27) * 1.6 : p.ceil;
  p.potG = DY.gradeFor(fc + gauss() * (a <= 23 ? 2.4 : 1));
  if (p.campPot){ p.campPot = 0; }
  p.entry = clamp(p.entry + gauss() * 2, 10, 98);
  return {d:p.ovr - old, ev:ev, from:old, to:p.ovr};
};
DY.progression = function(){
  var g = G();
  DY.active().forEach(function(p){
    var r = DY.develop(p), evo = p.yrs >= 1 && DY.evolve ? DY.evolve(p) : [];
    g.off.prog[p.id] = {d:Math.round(r.d * 10) / 10, ev:r.ev, from:Math.round(r.from), to:Math.round(r.to), evo:evo.length ? evo : undefined};
    if (r.ev === "boom" && p.ovr >= 80) DY.addLog(p, "Breakout offseason (+" + r.d.toFixed(1) + " OVR).");
    if (r.ev === "bust" || r.ev === "cliff") DY.addLog(p, r.ev === "cliff" ? "Fell off a cliff this offseason (" + r.d.toFixed(1) + " OVR)." : "Development stalled this offseason.");
    p.age++; p.yrs++;
  });
};

/* =====================================================================================
   LEGACY + HALL OF FAME
   ===================================================================================== */
DY.ACC_PTS = {MVP:14, FMVP:6, CHAMP:8, RU:2.5, AS1:5, AS2:3, ROY:3, MIP:2, AMVP:1, ACHAMP:0.5, SB:-1};
// Legacy = talent (season overalls above 80 + peak) + statistical dominance (WAR+, kills) + hardware (accolades carry the most weight)
DY.legacyParts = function(p){
  var talent = 0, war = 0, kills = 0, peak = 0;
  p.car.forEach(function(c){ var reg = DY.uS(c.reg), po = DY.uS(c.po); if (c.lvl === "BTL" && reg && reg.m >= 10){ talent += Math.max(0, (c.so || 0) - 80) * 0.5; } if (c.lvl === "BTL" && reg){ war += reg.war || 0; kills += reg.k || 0; } if (po){ war += (po.war || 0) * 1.3; kills += po.k || 0; } peak = Math.max(peak, c.ovr || 0); });
  peak = Math.max(peak, Math.round(p.ovr));
  var acc = sum(p.acc.map(function(a){ return DY.ACC_PTS[a.a] || 0; }));
  return {talent:talent + Math.max(0, peak - 85), stats:Math.max(0, war) * 0.8 + kills / 1000, acc:acc};
};
// legacy earned only while playing for one franchise (seasons + trophies won there)
DY.teamLegacy = function(p, t){
  var on = function(tm){ return tm && String(tm).split("/").indexOf(t.abbr) >= 0; };
  var talent = 0, war = 0, kills = 0, peak = 0, n = 0;
  p.car.forEach(function(c){ if (c.lvl !== "BTL" || !on(c.tm)) return; var reg = DY.uS(c.reg), po = DY.uS(c.po); n++; if (reg && reg.m >= 10) talent += Math.max(0, (c.so || 0) - 80) * 0.5; if (reg){ war += reg.war || 0; kills += reg.k || 0; } if (po){ war += (po.war || 0) * 1.3; kills += po.k || 0; } peak = Math.max(peak, c.ovr || 0); });
  var acc = sum(p.acc.filter(function(a){ return a.t === t.abbr; }).map(function(a){ return DY.ACC_PTS[a.a] || 0; }));
  return {score:Math.round((talent + Math.max(0, peak - 85) * 0.5 + Math.max(0, war) * 0.8 + kills / 1000 + acc) * 10) / 10, seasons:n, acc:p.acc.filter(function(a){ return a.t === t.abbr; })};
};
DY.legacy = function(p){ var x = DY.legacyParts(p); return Math.round((x.talent + x.stats + x.acc) * 10) / 10; };
DY.HOF_LEGACY = 150;
DY.HOF_RULE = "Retired players with a Legacy Score of 150+, or 2+ MVPs, or 3+ championships with 3+ All-Star selections. Inducted the offseason they retire.";
DY.hofEligible = function(p){ var c = function(a){ return p.acc.filter(function(x){ return x.a === a; }).length; }; return p.legacy >= DY.HOF_LEGACY || c("MVP") >= 2 || (c("CHAMP") >= 3 && c("AS1") + c("AS2") >= 3); };
DY.hofInductions = function(){
  var g = G();
  g.off.retired.forEach(function(id){ var p = g.P[id]; if (DY.hofEligible(p) && g.hof.indexOf(id) < 0){ g.hof.push(id); p.hofS = g.season; g.off.hof.push(id); DY.addLog(p, "Inducted into the Dynasty Hall of Fame (Class of Season " + g.season + ")."); } });
};
DY.legacyBoard = function(n){ return DY.allP().filter(function(p){ return p.legacy > 0; }).sort(function(a, b){ return b.legacy - a.legacy; }).slice(0, n || 50); };

/* =====================================================================================
   CONTRACTS ROLL OVER: a season was served. Options come due; finished deals hit free agency.
   ===================================================================================== */
DY.contractsRollover = function(){
  var g = G();
  g.teams.forEach(function(t){ t.deadNext = 0; });
  DY.active().forEach(function(p){
    if (p.team == null || !p.con) return;
    var c = p.con;
    if (c.fresh){ delete c.fresh; return; }            // extension signed this season: starts now
    c.yrs--;
    if (c.yrs > 0) return;
    if (c.opt){ g.off.opts[p.id] = {type:c.type, tid:p.team, decided:false}; return; }
    expire(p);
  });
  // player options decided by the players now; CPU team options decided now too. The user decides theirs in the "Options" step.
  Object.keys(g.off.opts).forEach(function(id){
    var o = g.off.opts[id], p = g.P[id], t = g.teams[o.tid];
    if (DY.ctype(o.type).o === "P"){
      var mv = DY.marketValue(p), out = DY.teamOutlook(t), optOut = (mv > p.con.sal * 1.15 && p.pri.money >= 0.25) || (out < 0.35 && p.pri.win >= 0.35) || p.rel < 25;
      o.decided = true; o.exercise = !optOut; if (optOut){ DY.addLog(p, "Declined his player option."); expire(p); } else { exercise(p); DY.addLog(p, "Picked up his player option."); }
    } else if (!t.user || g.settings.auto){
      var keep = DY.tradeValue(p, t) >= p.con.sal * (t.tag === "Rebuilding" ? 1.4 : 1.05) && (t.tag !== "Rebuilding" || p.age <= 26 || p.con.sal <= 120);
      if (keep && DY.draftMinded && DY.draftMinded(t) && p.id === DY.weakestOption(t.id) && DY.knownOvr(p) < 86) keep = false;   // clear a spot for the draft
      o.decided = true; o.exercise = keep; if (keep){ exercise(p); DY.addLog(p, t.name + " exercised his team option."); } else { DY.addLog(p, t.name + " declined his team option."); expire(p); }
    }
  });
};
function exercise(p){ p.con.yrs = 1; p.con.opt = false; p.con.optDone = true; }
function expire(p){
  var g = G(), t = g.teams[p.team];
  t.roster = t.roster.filter(function(i){ return i !== p.id; }); t.lineup = t.lineup.filter(function(i){ return i !== p.id; });
  DY.leaveTeam(p, t.id, "expire");
  if (p.con && p.con.rookie) p.rfa = t.id;          // coming off a rookie deal: restricted free agent (his team can match)
  p.formerTeam = t.id; p.relMem = p.rel; p.team = null; p.con = null; p.status = "fa"; p.minor = null;
  p.faSince = g.season;
}
DY.userOption = function(pid, ex){
  var g = G(), o = g.off.opts[pid], p = g.P[pid]; if (!o || o.decided || o.tid !== g.user) return;
  o.decided = true; o.exercise = !!ex;
  if (ex){ exercise(p); p.rel = clamp(p.rel + 4, 0, 100); DY.addLog(p, g.teams[o.tid].name + " exercised his team option."); DY.tx(g.teams[o.tid].abbr + " exercised " + p.n + "'s option (" + DY.money(p.con.sal) + ")", [o.tid]); }
  else { DY.addLog(p, g.teams[o.tid].name + " declined his team option."); DY.tx(g.teams[o.tid].abbr + " declined " + p.n + "'s option", [o.tid]); expire(p); }
};
DY.pendingUserOptions = function(){ var g = G(); return Object.keys(g.off.opts).filter(function(id){ var o = g.off.opts[id]; return o.tid === g.user && !o.decided; }).map(Number); };

/* =====================================================================================
   ROOKIE CLASS — scouted, ranked, never guaranteed
   ===================================================================================== */
var ARCH = [["gen", .03], ["star", .09], ["starter", .2], ["gem", .09], ["bust", .12], ["serv", .32], ["scrub", .15]];
DY.ARCH = ARCH;
DY.ARCH_NAME = {gen:"Generational", star:"Future star", starter:"Starter", gem:"Hidden gem", bust:"Bust", serv:"Serviceable", scrub:"Long shot"};
// prospects = true: the next class is created at the start of a season so teams can scout it all year.
// Otherwise (old saves) the class is created at the start of the offseason, as before.
DY.ARCH_CAP = {gen:2, star:4, gem:3};       // high-ceiling talent is limited per class (max 5 generational + future stars), ceilings themselves aren't capped
DY.rookieClass = function(prospects){
  var g = G(), taken = {}; DY.allP().forEach(function(p){ taken[p.n.toLowerCase()] = 1; });
  var activeN = DY.active().length, n = clamp((prospects ? 152 : 142) - activeN + rint(1, 4), 10, 16);
  var list = [], cnt = {};
  for (var i = 0; i < n; i++){
    var arche = wpick(ARCH, function(x){ return x[1]; })[0];
    if (arche === "gen" && (cnt.gen || 0) >= 1 && !chance(0.25)) arche = "star";        // two generational talents in one class is rare
    if (DY.ARCH_CAP[arche] != null && (cnt[arche] || 0) >= DY.ARCH_CAP[arche]) arche = "starter";
    if ((arche === "gen" || arche === "star") && (cnt.gen || 0) + (cnt.star || 0) >= 5) arche = "starter";
    cnt[arche] = (cnt[arche] || 0) + 1; list.push(arche);
  }
  if (list.indexOf("gen") < 0 && list.indexOf("star") < 0 && chance(0.6)) list[list.indexOf("starter") >= 0 ? list.indexOf("starter") : 0] = "star";
  var out = list.map(function(arche){
    var p = DY.baseP(g.nid++, DY.makeName(taken)), o, c;
    if (arche === "gen"){ o = rr(82, 88); c = rr(95, 99.4); }
    else if (arche === "star"){ o = rr(75, 82); c = rr(89, 95); }
    else if (arche === "starter"){ o = rr(71, 78); c = rr(82, 88); }
    else if (arche === "gem"){ o = rr(65, 72); c = rr(85, 92); }
    else if (arche === "bust"){ o = rr(70, 78); c = o + rr(0, 2.5); }
    else if (arche === "scrub"){ o = rr(56, 64); c = o + rr(1, 5); }
    else { o = rr(62, 73); c = o + rr(3, 8); }
    p.role = chance(0.5) ? "AR" : "SMG";
    var spec = pick(["gun", "hp", "snd", "ctl", "obj", null]);
    p.at = {gun:o - 1 + gauss() * 4.5, hp:o - 1 + gauss() * 4.5, snd:o - 1 + gauss() * 5, ctl:o - 1 + gauss() * 4.5, obj:(p.role === "SMG" ? 72 : 63) + (o - 76) * 0.3 + gauss() * 8};
    if (spec) p.at[spec] += rr(4, 8);
    DY.ATTR.forEach(function(k){ p.at[k] = clamp(p.at[k], 40, 99); }); p.ovrAdj = 0; p.ovrAdj = o - DY.calcOvr(p.at); DY.setOvr(p);
    p.maps = {}; for (var mi = 0; mi < 2; mi++){ var md = pick(DY.MODES), mk = pick(Object.keys(DY.MAP_W[md])); p.maps[md + "|" + mk] = Math.round(gauss() * 15) / 10; }
    p.ceil = clamp(Math.max(c, p.ovr), p.ovr, 99.4);
    p.age = rint(18, 21); p.yrs = 0;
    p.cons = clamp(60 + gauss() * 12, 30, 92); p.clutch = clamp(58 + gauss() * 14, 25, 95); p.lead = clamp(42 + gauss() * 12, 15, 85); p.chem = clamp(66 + gauss() * 13, 25, 95);
    p.work = arche === "gem" ? rr(74, 95) : arche === "bust" ? rr(38, 62) : clamp(64 + gauss() * 12, 30, 95);
    p.avail = clamp(.02 + Math.abs(gauss()) * .012, .01, .05); p.entry = clamp(50 + gauss() * 16, 10, 95);
    p.pri = DY.randPri({pt:.22});
    var hold = arche === "gen" && chance(0.5);
    if (hold) p.pri = DY.randPri({win:.25, pt:.05});
    p.persona = DY.personaLabel(p.pri);
    p.style = p.entry >= 72 ? "Aggressive" : p.entry >= 62 ? "Fast-paced" : p.entry <= 36 ? "Slow / anchor" : p.at.obj >= 80 && p.role === "SMG" ? "Objective player" : "Balanced";
    var bias = arche === "gem" ? -5 : arche === "bust" ? 5 : 0, cbias = arche === "gem" ? -7 : arche === "bust" ? 8 : 0;
    var est = clamp(p.ovr + gauss() * 3.2 + bias, 55, 92), estC = clamp(p.ceil + gauss() * 3.2 + cbias, est, 99);
    p.potG = DY.gradeFor(estC);
    var kd = clamp(0.74 + (p.ovr - 60) * 0.017 + gauss() * 0.07, 0.6, 1.6);
    p.rookie = {cls:g.season + 1, hidden:true, est:Math.round(est * 10) / 10, estC:estC, arche:arche, holdout:hold,
      scout:{kd:Math.round(kd * 100) / 100, snd:Math.round(clamp(kd + (p.at.snd - p.ovr) * 0.014 + gauss() * 0.1, .5, 2) * 100) / 100, resp:Math.round(clamp(kd + (p.at.hp - p.ovr) * 0.01 + gauss() * 0.05, .5, 1.7) * 100) / 100, ip:Math.round((35 + (p.entry - 50) * 0.12 + gauss() * 2) * 10) / 10, maps:rint(40, 140)}};
    p.status = prospects ? "prospect" : "fa"; p.team = null; p.minor = null;
    g.P[p.id] = p; return p;
  });
  DY.assignMentors(out);
  out.sort(function(a, b){ return (b.rookie.estC * 0.62 + b.rookie.est * 0.38) - (a.rookie.estC * 0.62 + a.rookie.est * 0.38); });
  out.forEach(function(p, i){ p.rookie.rank = i + 1; DY.addLog(p, "Ranked the #" + (i + 1) + " prospect in the Season " + (g.season + 1) + " class."); });
  if (prospects) return out;
  g.off.rookies = out.map(function(p){ return p.id; });
};

/* =====================================================================================
   FREE AGENCY (3 weeks). CPU teams bid, the user bids, players answer at the end of each week.
   ===================================================================================== */
DY.faPool = function(){ return DY.active().filter(function(p){ return p.team == null; }); };
DY.startFreeAgency = function(){
  var g = G();
  // any undecided user options default to "exercise"
  DY.pendingUserOptions().forEach(function(id){ DY.userOption(id, true); });
  DY.settleDraft();
  g.off.stage = "fa"; g.off.week = 1; g.fa = {offers:{}, log:[], rfa:{}};
  DY.cpuFaOffers();
  DY.cpuOffersToUser();
};
DY.faOffersFor = function(pid){ var g = G(); return (g.fa && g.fa.offers[pid]) || []; };
DY.committed = function(t){ var g = G(), c = 0; if (!g.fa) return 0; Object.keys(g.fa.offers).forEach(function(pid){ g.fa.offers[pid].forEach(function(o){ if (o.tid === t.id) c += o.sal; }); }); return c; };
DY.openSlots = function(t){ return DY.ROSTER - t.roster.length; };
DY.userFaOffer = function(pid, sal, type){
  var g = G(), t = DY.userT(), p = g.P[pid], vt = DY.validType(type); if (vt) return {err:vt};
  if (g.phase !== "offseason" || g.off.stage !== "fa") return {err:"Free agency isn't open."};
  if (p.team != null) return {err:"He's under contract."};
  sal = Math.round(sal / 5) * 5;
  if (sal < DY.MIN_SAL || sal > DY.MAX_SAL) return {err:"Offers must be between " + DY.money(DY.MIN_SAL) + " and " + DY.money(DY.MAX_SAL) + "."};
  var list = g.fa.offers[pid] = (g.fa.offers[pid] || []).filter(function(o){ return o.tid !== t.id; });
  var mine = DY.committed(t);
  if (sal + mine > DY.space(t) && sal > DY.MIN_SAL) return {err:"Not enough budget space. You have " + DY.money(DY.space(t) - mine) + " free after your other offers."};
  var pendingN = Object.keys(g.fa.offers).filter(function(k){ return g.fa.offers[k].some(function(o){ return o.tid === t.id; }); }).length;
  if (DY.openSlots(t) <= 0) return {err:"Your roster is full (5). Release or trade someone first."};
  if (pendingN >= DY.openSlots(t) + 2) return {err:"You can have at most " + (DY.openSlots(t) + 2) + " offers out with " + DY.openSlots(t) + " open roster spot(s)."};
  var ev = DY.evalOffer(p, {tid:t.id, sal:sal, type:type}, {week:g.off.week, rival:false});
  list.push({tid:t.id, sal:sal, type:type, wk:g.off.week, user:true, tone:ev.tone, why:ev.why});
  return {ok:true, ev:ev};
};
DY.withdrawFaOffer = function(pid){ var g = G(); if (g.fa && g.fa.offers[pid]) g.fa.offers[pid] = g.fa.offers[pid].filter(function(o){ return !o.user; }); };
function teamFaValue(t, p){
  var ko = DY.knownOvr(p), kc = DY.knownCeil(p), v = ko;
  if (t.tag === "Rebuilding") v += (p.age <= 23 ? (kc - ko) * 0.6 : -Math.max(0, p.age - 26) * 1.2);
  else if (t.tag === "Buying") v += p.age <= 23 ? (kc - ko) * 0.3 : 0;
  if (t.plan === "draft") v += p.age <= 23 ? (kc - ko) * 0.3 : -Math.max(0, p.age - 27) * 0.8;
  if (p.rfa === t.id || (p.drafted && p.drafted.tid === t.id)) v += 4;        // bring the home-grown guy back
  else v += p.age <= 22 ? (kc - ko) * 0.15 : 0;
  // need: role + weakest mode
  var c = DY.roleCounts(t.roster);
  if ((p.role === "AR" && c.ar + c.fx < 2) || (p.role === "SMG" && c.smg + c.fx < 2)) v += 3;
  var weak = DY.MODES.map(function(m){ return [m, t.roster.length ? DY.modeRating(t, m) : 0]; }).sort(function(a, b){ return a[1] - b[1]; })[0][0], k = weak === "HP" ? "hp" : weak === "SND" ? "snd" : "ctl";
  if (!DY.hiddenOvr(p) && p.at[k] - p.ovr >= 2) v += 1.2;
  return v + gauss() * 1.2;
}
DY.cpuFaOffers = function(){
  var g = G(), pool = DY.faPool();
  g.teams.forEach(function(t){
    if (t.user && !g.settings.auto) return;
    // drop stale offers on players who are gone
    var slots = DY.openSlots(t), worst = null;
    if (slots <= 0){ // full roster: only chase a clear upgrade over a cheap, weak player
      worst = t.roster.map(function(i){ return g.P[i]; }).filter(function(p){ return p.con && p.con.sal <= (DY.space(t) > 300 ? 200 : 120); }).sort(function(a, b){ return a.ovr - b.ovr; })[0];
      if (!worst) return;
    }
    var mine = Object.keys(g.fa.offers).filter(function(k){ return g.fa.offers[k].some(function(o){ return o.tid === t.id; }); }).length;
    var maxOffers = (slots > 0 ? slots + 1 : DY.space(t) > 300 ? 2 : 1) + (t.plan === "fa" ? 1 : 0) - mine; if (maxOffers <= 0) return;
    var space = DY.space(t) - DY.committed(t);
    var c = DY.roleCounts(t.roster);
    var cands = pool.filter(function(p){
      if (g.fa.offers[p.id] && g.fa.offers[p.id].some(function(o){ return o.tid === t.id; })) return false;
      var ids = t.roster.concat([p.id]); if (worst) ids = ids.filter(function(i){ return i !== worst.id; });
      if (!DY.roleFeasible(ids)) return false;
      if (worst && DY.knownOvr(p) < worst.ovr + (DY.space(t) > 300 ? 3 : 4.5)) return false;
      return true;
    }).map(function(p){ return {p:p, v:teamFaValue(t, p)}; }).sort(function(a, b){ return b.v - a.v; });
    for (var i = 0; i < cands.length && maxOffers > 0; i++){
      var p = cands[i].p, ask = DY.askFor(p, t.id);
      var mult = (t.tag === "Contender" ? rr(0.96, 1.12) : t.tag === "Rebuilding" ? rr(0.86, 1.02) : rr(0.92, 1.06)) + (t.plan === "fa" ? 0.06 : 0) + (p.rfa === t.id ? 0.05 : 0);
      if (g.off.week === 3) mult += 0.04;
      var sal = Math.round(clamp(ask * mult, DY.MIN_SAL, DY.MAX_SAL) / 5) * 5;
      if (sal > space) { if (ask <= space + 20) sal = Math.round(space / 5) * 5; else continue; }
      if (sal < DY.MIN_SAL) continue;
      // don't burn the whole budget on one player if there are holes to fill
      if (slots >= 2 && sal > space - DY.MIN_SAL * (slots - 1)) continue;
      var type = DY.cpuType(t, p);
      (g.fa.offers[p.id] = g.fa.offers[p.id] || []).push({tid:t.id, sal:sal, type:type, wk:g.off.week, drop:worst ? worst.id : null});
      space -= sal; maxOffers--;
      if (worst && maxOffers <= 0) break;
    }
  });
};
// restricted free agency (players coming off rookie deals)
DY.rfaCanMatch = function(O, p, o){ var own = (DY.faOffersFor(p.id).find(function(x){ return x.tid === O.id; }) || {sal:0}).sal; return DY.openSlots(O) > 0 && o.sal <= DY.space(O) - (DY.committed(O) - own) && DY.roleFeasible(O.roster.concat([p.id])); };
DY.rfaWants = function(O, p, sal){ var home = p.drafted && p.drafted.tid === O.id; return DY.tradeValue(p, O) >= sal * (home ? 0.75 : 1) || (home && DY.knownOvr(p) >= 83) || (O.plan === "core" && DY.knownOvr(p) >= 80); };
DY.rfaPending = function(){ var g = G(); return g.fa && g.fa.rfa ? Object.keys(g.fa.rfa).map(Number) : []; };
DY.rfaDecide = function(pid, match){
  var g = G(), x = g.fa && g.fa.rfa && g.fa.rfa[pid], p = g.P[pid]; if (!x) return "That offer sheet is gone.";
  var O = g.teams[p.rfa], t = g.teams[x.tid];
  delete g.fa.rfa[pid]; delete g.fa.offers[pid];
  if (match){ if (!DY.rfaCanMatch(O, p, x)) return "You can't fit that contract anymore."; DY.signPlayer(p, O.id, x.sal, x.type, "Matched an offer sheet and re-signed with"); p.signedWk = g.season * 100 + 90; DY.remember(p, O.id, 4); DY.news("fa", O.name + " match for " + p.n, O.name + " matched " + t.name + "'s offer sheet: " + p.n + " stays home at " + DY.money(x.sal) + ".", {pid:pid, tid:O.id}); return null; }
  if ((DY.openSlots(t) > 0 || (x.drop != null && t.roster.indexOf(x.drop) >= 0)) && x.sal <= DY.space(t) + 1){ if (x.drop != null) DY.release(x.drop, true); DY.signPlayer(p, t.id, x.sal, x.type); p.signedWk = g.season * 100 + 90; DY.news("fa", p.n + " heads to " + t.city, O.name + " declined to match. " + p.n + " signs with " + t.name + " (" + DY.money(x.sal) + ").", {pid:pid, tid:t.id}); }
  return null;
};
DY.endFaWeek = function(){
  var g = G(), wk = g.off.week, signed = [];
  if (g.off.rfaHold){ g.off.rfaHold = false; DY.rfaPending().forEach(function(pid){ DY.rfaDecide(pid, false); }); DY.finalizeOffseason(); return []; }
  DY.rfaPending().forEach(function(pid){ DY.rfaDecide(pid, false); });     // offer sheets you didn't answer: he signs it
  var ids = shuffle(Object.keys(g.fa.offers).map(Number));
  ids.forEach(function(pid){
    var p = g.P[pid]; if (g.fa.rfa && g.fa.rfa[pid]) return;          // waiting on his old team to match
    var list = (g.fa.offers[pid] || []).filter(function(o){ var t = g.teams[o.tid]; if (p.team != null || !(DY.openSlots(t) > 0 || (o.drop != null && t.roster.indexOf(o.drop) >= 0)) || (o.sal > DY.space(t) + 1 && o.sal > DY.MIN_SAL)) return false; var ids = t.roster.filter(function(i){ return i !== o.drop; }).concat([p.id]); return DY.roleFeasible(ids); });
    if (!list.length){ delete g.fa.offers[pid]; return; }
    var scored = list.map(function(o){ var ev = DY.evalOffer(p, o, {week:wk}); return {o:o, s:ev.score + gauss() * 0.12, ev:ev}; }).sort(function(a, b){ return b.s - a.s; });
    var best = scored[0], thr = wk === 1 ? 0.3 : wk === 2 ? 0.08 : -0.6;
    if (p.rookie && p.rookie.hidden) thr -= 0.15;           // most rookies just want to get to the main league
    if (p.rookie && p.rookie.holdout && wk < 3) thr += 0.2;
    if (list.length >= 2 && wk === 1) thr += 0.08;            // a bidding war: he can wait
    if (best.s >= thr){
      var o = best.o, t = g.teams[o.tid];
      // restricted free agent: his old team gets to match the offer sheet
      if (p.rfa != null && o.tid !== p.rfa && g.teams[p.rfa]){
        var O = g.teams[p.rfa];
        if (DY.rfaCanMatch(O, p, o)){
          if (O.user && !g.settings.auto){ g.fa.rfa[pid] = {tid:o.tid, sal:o.sal, type:o.type, drop:o.drop, wk:wk}; DY.news("fa", p.n + " signs an offer sheet", p.n + " agreed to an offer sheet with " + t.name + ": " + DY.money(o.sal) + ", " + DY.conName(o.type) + ". He's a restricted free agent — " + O.name + " can match it and keep him.", {pid:pid, tid:O.id}); return; }
          if (DY.rfaWants(O, p, o.sal)){ DY.news("fa", O.name + " match for " + p.n, t.name + " signed " + p.n + " to an offer sheet (" + DY.money(o.sal) + ") and " + O.name + " matched it. Home-grown stays home.", {pid:pid, tid:O.id}); o = {tid:O.id, sal:o.sal, type:o.type, drop:null}; t = O; }
          else DY.news("fa", O.name + " let " + p.n + " walk", O.name + " declined to match " + t.name + "'s offer sheet for " + p.n + " (" + DY.money(o.sal) + ").", {pid:pid, tid:t.id});
        }
      }
      if (o.drop != null) DY.release(o.drop, true);
      DY.signPlayer(p, t.id, o.sal, o.type);
      p.signedWk = g.season * 100 + 90;
      signed.push({pid:pid, tid:t.id, sal:o.sal, type:o.type, n:list.length, wk:wk});
      delete g.fa.offers[pid];
    } else {
      // feedback refresh for the user's offer
      var u = scored.find(function(x){ return x.o.user; }); if (u){ u.o.tone = u.ev.tone; u.o.why = u.ev.why; u.o.ranked = scored.indexOf(u) + 1; u.o.of = scored.length; }
    }
  });
  // remove offers from teams that filled up or ran out of money
  Object.keys(g.fa.offers).forEach(function(pid){ g.fa.offers[pid] = g.fa.offers[pid].filter(function(o){ var t = g.teams[o.tid]; return (DY.openSlots(t) > 0 || o.drop != null) && o.sal <= DY.space(t); }); if (!g.fa.offers[pid].length) delete g.fa.offers[pid]; });
  // bidding wars: CPU teams that are still in on a player may raise their offer for next week
  var raises = [];
  Object.keys(g.fa.offers).forEach(function(pid){ var list = g.fa.offers[pid], p = g.P[pid]; if (list.length < 2 || p.team != null) return; var top = Math.max.apply(null, list.map(function(o){ return o.sal; }));
    list.forEach(function(o){ var t = g.teams[o.tid]; if (o.user || (t.user && g.settings.auto !== true)) return; if (o.sal >= top && chance(0.6)) return; if (!chance(0.55)) return; var ns = Math.round(Math.min(DY.MAX_SAL, Math.max(o.sal * rr(1.05, 1.13), top * rr(0.98, 1.06))) / 5) * 5; if (ns - o.sal > DY.space(t) - DY.committed(t)) return; if (ns > o.sal){ raises.push({pid:+pid, tid:o.tid, from:o.sal, to:ns}); o.sal = ns; o.raised = (o.raised || 0) + 1; } }); });
  g.fa.log.push({wk:wk, signed:signed, raises:raises});
  DY.faWeekNews(wk, signed);
  if (wk < 3){ g.off.week++; DY.cpuFaOffers(); DY.cpuTrades(); DY.cpuOffersToUser(); }
  else if (DY.rfaPending().length) g.off.rfaHold = true;        // answer the last offer sheets, then free agency closes
  else DY.finalizeOffseason();
  return signed;
};

/* =====================================================================================
   FINALIZE -> NEW SEASON
   ===================================================================================== */
DY.fillRoster = function(t, auto){
  var g = G(), guard = 0;
  while (t.roster.length < DY.ROSTER && guard++ < 10){
    var c = DY.roleCounts(t.roster), needRole = c.ar + c.fx < 2 ? "AR" : c.smg + c.fx < 2 ? "SMG" : null, space = DY.space(t);
    var pool = DY.faPool().filter(function(p){ return !needRole || p.role === needRole || p.flex != null; }).map(function(p){ return {p:p, ask:Math.max(DY.MIN_SAL, Math.min(DY.askFor(p, t.id), DY.salaryFor(DY.knownOvr(p))))}; }).filter(function(x){ return x.ask <= space - DY.MIN_SAL * Math.max(0, DY.ROSTER - t.roster.length - 1) || x.ask === DY.MIN_SAL; })
      .sort(function(a, b){ return DY.knownOvr(b.p) - DY.knownOvr(a.p); });
    var f = pool[0];
    if (!f){ var any = DY.faPool().filter(function(p){ return !needRole || p.role === needRole; }).sort(function(a, b){ return DY.knownOvr(b) - DY.knownOvr(a); })[0]; if (!any) break; f = {p:any, ask:DY.MIN_SAL}; }
    DY.signPlayer(f.p, t.id, Math.min(f.ask, Math.max(DY.MIN_SAL, space)), "1+1T", auto ? "Auto-signed by" : "Signed with");
  }
};
DY.finalizeOffseason = function(){
  var g = G();
  // last call: good players nobody signed take the best deal left rather than drop to the Academy
  DY.faPool().filter(function(p){ return DY.knownOvr(p) >= 78; }).sort(function(x, y){ return DY.knownOvr(y) - DY.knownOvr(x); }).forEach(function(p){
    var best = null;
    g.teams.forEach(function(t){ if ((t.user && !g.settings.auto) || DY.openSlots(t) <= 0) return; if (!DY.roleFeasible(t.roster.concat([p.id]))) return; var room = DY.space(t) - DY.MIN_SAL * Math.max(0, DY.openSlots(t) - 1); var sal = Math.min(DY.askFor(p, t.id), Math.max(DY.MIN_SAL, room)); if (!best || sal > best.sal || (sal === best.sal && DY.teamOutlook(t) > DY.teamOutlook(best.t))) best = {t:t, sal:sal}; });
    if (best && best.sal >= Math.min(DY.askFor(p, best.t.id) * 0.35, 150)) { DY.signPlayer(p, best.t.id, Math.round(best.sal / 5) * 5, "1", "Late signing with"); DY.news("fa", p.n + " takes a late deal", p.n + " was still on the board when free agency closed and signs a one-year deal with " + best.t.name + " for " + DY.money(best.sal) + ".", {pid:p.id, tid:best.t.id}); }
  });
  g.teams.forEach(function(t){ if (!t.user) DY.fillRoster(t); });
  var u = DY.userT(); if (u.roster.length < DY.ROSTER){ var n0 = u.roster.length; DY.fillRoster(u, true); if (u.roster.length > n0) DY.news("move", "Roster filled", "Your roster had open spots at the end of free agency, so the league office auto-signed the best available players at the minimum.", {tid:u.id}); }
  DY.active().forEach(function(p){ if (p.team == null) p.rfa = null; });
  g.fa = null;
  g.season++;
  g.off = null;
  // academy re-draft for everyone without a main contract
  DY.academyDraft();
  // reveal rookies who are on main rosters
  var reveals = [];
  DY.active().forEach(function(p){ if (p.rookie && p.rookie.hidden && p.team != null){ p.rookie.hidden = false; reveals.push(p); } p.relMem = null; });
  g.teams.forEach(function(t){ t.dead = t.deadNext || 0; t.deadNext = 0; t.cashAdj = 0; t.userTag = t.user ? t.userTag : false; });
  DY.setTags(true);
  DY.cpuScouting();
  DY.active().forEach(function(p){ p.draftRights = null; p.draftDeclined = null; p.undrafted = null; });
  DY.resetPicks();
  Object.keys(g.scout || {}).forEach(function(tid){ var m = g.scout[tid]; Object.keys(m).forEach(function(pid){ var p = g.P[pid]; if (!p || !p.rookie || !p.rookie.hidden || p.status === "retired") delete m[pid]; }); });
  DY.newSeasonSetup();
  DY.active().forEach(function(p){ p.ovrH.push({s:g.season, o:Math.round(p.ovr)}); });
  g.phase = "preseason";
  DY.rookieRevealNews(reveals);
  DY.preseasonNews();
};
})(typeof window !== "undefined" ? window : globalThis);
