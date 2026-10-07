/* DYNASTY: money, contracts, negotiations, free agency, extensions, trades, team strategy, fan engagement. */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, rint = DY.rint, rr = DY.rr, pick = DY.pick, shuffle = DY.shuffle, chance = DY.chance, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };

/* =====================================================================================
   VALUE
   ===================================================================================== */
var GRADE_CEIL = {"A+":96, "A":92.5, "A-":89.5, "B+":86.5, "B":83.5, "B-":80.5, "C+":77.5, "C":74.5, "C-":71.5, "D":68};
DY.knownOvr = function(p){ return DY.hiddenOvr(p) ? p.rookie.est : p.ovr; };
DY.knownCeil = function(p){ return Math.max(DY.knownOvr(p), GRADE_CEIL[p.potG] || DY.knownOvr(p)); };
DY.recentHardware = function(p){ var s = G().season, v = 0; p.acc.forEach(function(a){ if (a.s >= s - 1){ v += a.a === "MVP" ? 1.6 : a.a === "FMVP" ? 0.6 : a.a === "AS1" ? 0.8 : a.a === "AS2" ? 0.4 : a.a === "CHAMP" ? 0.4 : a.a === "ROY" ? 0.4 : 0; } }); return Math.min(2.5, v); };
// what the market thinks a player is worth per season ($k)
DY.marketValue = function(p){
  var ko = DY.knownOvr(p), adj = ko;
  if (p.age <= 23) adj += (DY.knownCeil(p) - ko) * 0.3;
  if (p.age >= 30) adj -= (p.age - 29) * 0.6;
  adj += DY.recentHardware(p) + (G().season <= 2 ? Math.min(1.5, (p.rep || 0) * 0.2) : 0);
  if (p.rookie && p.rookie.hidden) adj += p.rookie.arche === "gen" ? 4 : p.rookie.arche === "star" ? 1.5 : 0;   // agents know who they have
  return DY.salaryFor(adj);
};
// what the player asks for from a given team
DY.askFor = function(p, tid){
  var mv = DY.marketValue(p), m = 0.86 + p.pri.money * 0.62;
  if (tid != null && p.team === tid) m -= clamp((p.rel - 50) / 100, -0.1, 0.3) * p.pri.loyal * 1.4;
  if (p.rookie && p.rookie.hidden && p.rookie.holdout) m += 0.08;
  if (p.draftRights && p.draftRights.prem) m += p.draftRights.prem;
  if (p.draftRights && p.rookie && p.rookie.holdout && tid != null && DY.teamOutlook(G().teams[tid]) < 0.5) m += 0.12;   // "I wanted to go to a contender": costs extra
  // winners get (slightly) more expensive: a ring in the last season or two
  var rings = p.acc.filter(function(a){ return a.a === "CHAMP" && a.s >= G().season - 1; }).length; m += Math.min(0.08, rings * 0.04);
  if (tid != null && DY.bondWith){
    var bw = DY.bondWith(p, tid); m += bw.f < 0 ? -bw.f * 0.1 : -bw.f * 0.06;      // friends there: small discount. A beef there: premium
    var mem = DY.memWith(p, tid); m += mem < 0 ? -mem / 300 : -mem / 600;           // bad blood costs extra, good history saves a little
  }
  return Math.round(clamp(mv * m, DY.MIN_SAL, DY.MAX_SAL) / 5) * 5;
};
/* Contracts: 1-4 guaranteed seasons, optionally followed by one team (T) or player (P) option season; 4 seasons max in total.
   Type strings: "3", "2+T", "3+P" … (old saves: "1", "2G", "1+1T", "1+1P" still read fine). */
DY.MAX_YEARS = 4;
DY.ctype = function(t){ if (t === "2G") return {g:2, o:null}; var m = /^(\d)(?:\+1?([TP]))?$/.exec(String(t || "1")); return m ? {g:+m[1], o:m[2] || null} : {g:1, o:null}; };
DY.mkType = function(g, o){ return String(g) + (o ? "+" + o : ""); };
DY.validType = function(t){ var c = DY.ctype(t); if (c.g < 1 || c.g > DY.MAX_YEARS) return "Contracts run 1 to " + DY.MAX_YEARS + " guaranteed seasons."; if (c.g + (c.o ? 1 : 0) > DY.MAX_YEARS) return "4 seasons max, including the option year (e.g. 3 + team option)."; return null; };
DY.conName = function(t){ var c = DY.ctype(t); return c.g + (c.g === 1 ? " season" : " seasons") + (c.o ? " + " + (c.o === "T" ? "team" : "player") + " option" : ""); };
DY.CON_TYPES = new Proxy({}, {get:function(o, k){ return DY.conName(k); }});
DY.conText = function(c){ if (!c) return "—"; var o = DY.ctype(c.type).o, on = o === "T" ? "team option" : "player option";
  var when = c.yrs >= 2 ? c.yrs + " seasons left" + (c.opt ? " + " + on : "") : c.opt ? (c.yrs >= 1 ? "1 season left + " + on : on + " year") : "expires after this season";
  return DY.money(c.sal) + " · " + DY.conName(c.type) + (c.rookie ? " (rookie deal)" : "") + " · " + when; };
DY.newCon = function(sal, type, tid){ var c = DY.ctype(type); return {sal:sal, type:type, yrs:c.g, opt:!!c.o, by:tid, signed:G().season}; };
// what a CPU front office offers: young upside = control, stars = term, vets = short. Plans tilt it.
DY.cpuType = function(t, p){
  var a = p.age, ko = DY.knownOvr(p), up = DY.knownCeil(p) - ko, plan = t.plan || "balanced";
  if (a <= 23 && up >= 4) return plan === "fa" ? pick(["2+T", "2"]) : pick(["3+T", "3", "2+T"]);
  if (a >= 30) return pick(["1", "1+T", "2"]);
  if (ko >= 88) return plan === "core" ? pick(["4", "3+T"]) : pick(["3", "2+P", "3+T", "2"]);
  return plan === "fa" ? pick(["1", "2", "1+T"]) : plan === "core" ? pick(["3", "2+T"]) : pick(["2", "2+T", "1+T", "3"]);
};

/* team projection 0..1 used by players judging "is this a contender?" */
DY.teamOutlook = function(t){
  var g = G(), rs = g.teams.map(function(x){ return DY.teamRating(x, DY.bestLineup(x.roster.length >= 4 ? x.roster : x.roster.concat([]))); });
  var mine = DY.teamRating(t, t.roster.length >= 4 ? DY.bestLineup(t.roster) : t.roster), rank = rs.filter(function(v){ return v > mine; }).length;
  var o = 1 - rank / 15;
  if (g.phase === "season" && t.w + t.l >= 2) o = o * 0.5 + (t.w / (t.w + t.l)) * 0.5;
  if (t.tag === "Contender") o += 0.08; if (t.tag === "Rebuilding") o -= 0.12;
  o += Math.min(0.1, (t.titlesRecent || 0) * 0.05);
  return clamp(o, 0, 1);
};
DY.wouldStart = function(p, t){ var ids = t.roster.filter(function(i){ return i !== p.id; }).concat([p.id]); return DY.bestLineup(ids).indexOf(p.id) >= 0; };
// how a player feels about the shape of a deal: veterans want security, rising kids bet on themselves, nobody loves a team option
function typePref(p, type){
  var c = DY.ctype(type), g = c.g, old = p.age >= 28, rising = p.age <= 23 && DY.knownCeil(p) - DY.knownOvr(p) >= 4, v;
  if (old) v = Math.min(0.45, (g - 1) * 0.15) - (g === 1 ? 0.15 : 0);
  else if (rising) v = g <= 2 ? 0.1 : -(g - 2) * 0.12;
  else v = g === 2 || g === 3 ? 0.15 : g === 1 ? 0 : 0.05;
  if (c.o === "T") v -= old ? 0.25 : 0.18; else if (c.o === "P") v += rising ? 0.3 : 0.15;
  if (p.pri.money >= 0.38 && g >= 3) v += 0.08;
  return v;
}
/* score an offer from the player's point of view, with plain-English feedback */
DY.evalOffer = function(p, o, ctx){
  var g = G(), t = g.teams[o.tid], ask = DY.askFor(p, o.tid);
  var money = clamp((o.sal / ask - 1) * 2.6, -1.6, 0.9), out = DY.teamOutlook(t), win = (out - 0.5) * 2;
  var cur = p.team === o.tid || p.formerTeam === o.tid, loyal = cur ? (p.rel - 50) / 45 : 0;
  var starts = DY.wouldStart(p, t), pt = starts ? 0.5 : -0.7;
  var sec = typePref(p, o.type);
  var s = p.pri.money * money * 2.1 + p.pri.win * win * 1.5 + p.pri.loyal * loyal * 1.7 + p.pri.pt * pt * 1.5 + sec * 0.45;
  if (!p.team && p.status === "fa") s += 0.25 + p.pri.pt * 0.5;      // main league over the academy
  if (p.trq && p.team === o.tid) s -= 1;
  if (p.rookie && p.rookie.holdout && win < 0.25 && (ctx.week || 1) < 3 && !ctx.rookie) s -= 0.7;   // drafted holdouts show it in their price instead (askFor)
  if (t.user && ctx.rival) s -= 0.05;
  if (p.rfa === o.tid) s += 0.12;          // home-grown: comfortable staying where he came up
  var bw = DY.bondWith ? DY.bondWith(p, o.tid) : {f:0, fr:[], en:[]}, mem = DY.memWith ? DY.memWith(p, o.tid) : 0;
  s += bw.f * 0.6 + mem / 30 * (0.35 + p.pri.loyal * 1.4);
  var why = [];
  if (bw.en.length && bw.f < -0.2) why.push(["bond", "Doesn't want to play with " + G().P[bw.en[0]].n]);
  if (mem <= -10) why.push(["mem", "Hasn't forgotten how things ended with " + t.abbr]);
  if (bw.fr.length && bw.f > 0.2) why.push(["bond+", "Wants to team up with " + G().P[bw.fr[0]].n]);
  if (money < -0.35 && p.pri.money >= 0.2) why.push(["money", "Wants more money" + (!ctx.quiet && rnd() < 0.7 ? " (looking for about " + DY.money(ask) + ")" : "")]);
  if (win < -0.2 && p.pri.win >= 0.28) why.push(["win", "Not sold on your team's chances to win"]);
  if (!starts && p.pri.pt >= 0.2) why.push(["pt", "Worried about a starting spot"]);
  if (sec < -0.05){ var ct = DY.ctype(o.type); why.push(["type", ct.o === "T" ? "Doesn't love the team option" : ct.g >= 3 && p.age <= 23 ? "Doesn't want to be locked in that long" : ct.g === 1 && p.age >= 28 ? "Wants more security than one season" : "Would prefer a different contract length"]); }
  if (loyal > 0.4) why.push(["loyal", "Appreciates the loyalty"]);
  if (p.rookie && p.rookie.holdout && win < 0.25) why.push(["hold", "Wants to start his career on a contender"]);
  if (mem >= 12) why.push(["mem+", "Good memories with this franchise"]);
  var shown = s + (ctx.quiet ? 0 : gauss() * 0.18), tone = shown > 0.45 ? "Loves the offer" : shown > 0.15 ? "Very interested" : shown > -0.1 ? "Open to it" : shown > -0.45 ? "Lukewarm" : "Not interested";
  return {score:s, ask:ask, money:money, win:win, starts:starts, tone:tone, why:why.slice(0, 2)};
};

/* =====================================================================================
   CONTRACT MOVES
   ===================================================================================== */
DY.signPlayer = function(p, tid, sal, type, how){
  var g = G(), t = g.teams[tid];
  if (p.minor != null && g.minors[p.minor]) g.minors[p.minor].roster = g.minors[p.minor].roster.filter(function(i){ return i !== p.id; });
  p.minor = null; p.team = tid; p.status = "main"; p.con = DY.newCon(sal, type, tid); p.trq = 0; p.rfa = null;
  p.rel = clamp(55 + (p.formerTeam === tid ? (p.relMem || 0) * 0.3 : 0) + (DY.memWith ? DY.memWith(p, tid) * 0.4 : 0) + gauss() * 5, 25, 90); p.tenure = p.formerTeam === tid ? (p.tenure || 0) : 0;
  if (t.roster.indexOf(p.id) < 0) t.roster.push(p.id);
  if (DY.meetTeam) DY.meetTeam(p, tid);
  if (p.rookie && !p.rookieSeason) p.rookieSeason = g.phase === "offseason" ? g.season + 1 : g.season;
  if (p.prevTeams.indexOf(tid) < 0) p.prevTeams.push(tid);
  DY.fixLineup(t);
  DY.addLog(p, (how || "Signed with") + " " + t.name + ": " + DY.money(sal) + ", " + DY.CON_TYPES[type] + ".");
  DY.tx(t.abbr + " signed " + p.n + " (" + DY.money(sal) + ", " + DY.CON_TYPES[type] + ")", [tid]);
};
DY.toAcademy = function(p){
  var g = G(); p.team = null; p.con = null; p.status = "fa";
  var m = g.minors.slice().sort(function(a, b){ return a.roster.length - b.roster.length; })[0];
  if (m && m.roster.length < 4){ m.roster.push(p.id); p.minor = m.id; } else p.minor = null;
};
DY.release = function(pid, quiet){
  var g = G(), p = g.P[pid], t = g.teams[p.team]; if (!t) return "Not on a roster.";
  if (g.phase === "playoffs") return "Rosters are locked for the playoffs.";
  var dead = p.con ? p.con.sal : 0;
  if (g.phase === "offseason") t.deadNext = (t.deadNext || 0) + (p.con && p.con.yrs >= 1 ? dead : 0); else t.dead = (t.dead || 0) + dead;
  t.roster = t.roster.filter(function(i){ return i !== pid; }); t.lineup = t.lineup.filter(function(i){ return i !== pid; });
  if (DY.leaveTeam) DY.leaveTeam(p, t.id, "release");
  p.formerTeam = t.id; p.relMem = p.rel - 15;
  DY.toAcademy(p); DY.fixLineup(t);
  DY.addLog(p, "Released by " + t.name + ".");
  DY.tx(t.abbr + " released " + p.n + (dead ? " (" + DY.money(dead) + " stays on the books)" : ""), [t.id]);
  if (!quiet && t.user) {}
  return null;
};
// in-season signing (immediate answer). Offseason signings go through the weekly free agency process instead.
DY.inSeasonSign = function(pid, sal, type, dropId){
  var g = G(), t = DY.userT(), p = g.P[pid], vt = DY.validType(type); if (vt) return {err:vt};
  if (g.phase !== "season" && g.phase !== "preseason") return {err:"Free agents sign through the offseason process right now."};
  if (p.team != null) return {err:"He's under contract."};
  var ids = t.roster.filter(function(i){ return i !== dropId; }).concat([pid]);
  if (ids.length > DY.ROSTER) return {err:"Your roster is full. Pick a player to release."};
  if (!DY.validRoster(ids) && ids.length >= 4) return {err:"Your roster has to keep at least 2 ARs and 2 SMGs."};
  var dropSal = dropId != null ? 0 : 0; // dead money stays
  if (sal > DY.space(t) + dropSal && sal > DY.MIN_SAL) return {err:"Not enough budget space (" + DY.money(DY.space(t)) + " left)."};
  if (sal < DY.MIN_SAL) return {err:"League minimum is " + DY.money(DY.MIN_SAL) + "."};
  var ev = DY.evalOffer(p, {tid:t.id, sal:sal, type:type}, {week:3});
  if (ev.score + gauss() * 0.12 < -0.05) return {no:true, ev:ev};
  if (dropId != null) DY.release(dropId, true);
  DY.signPlayer(p, t.id, sal, type);
  DY.news("move", t.name + " sign " + p.n, "Mid-season move: " + p.n + " comes up from the Academy" + (p.st && p.st.mi.m ? " after a " + (DY.kd(p.st.mi.k, p.st.mi.d)).toFixed(2) + " K/D run" : "") + ". " + DY.money(sal) + ".", {pid:pid, tid:t.id});
  return {ok:true, ev:ev};
};

/* =====================================================================================
   EXTENSIONS (in season, from week 3): players on their last contracted year or option year
   ===================================================================================== */
DY.extEligible = function(p){ var c = p.con; return !!c && (c.yrs <= 1) && p.team != null; };
DY.offerExtension = function(pid, sal, type){
  var g = G(), p = g.P[pid], t = DY.userT(), vt = DY.validType(type); if (vt) return {err:vt};
  if (g.phase !== "season" || g.week < 3) return {err:"Extension talks open after week 2."};
  if (p.team !== t.id || !DY.extEligible(p)) return {err:"He isn't eligible for an extension."};
  var x = g.ext[pid];
  if (x && (x.status === "broken" || x.status === "signed")) return {err:x.status === "signed" ? "Already extended." : "He has broken off talks until free agency."};
  if (sal < DY.MIN_SAL || sal > DY.MAX_SAL) return {err:"Salary must be between " + DY.money(DY.MIN_SAL) + " and " + DY.money(DY.MAX_SAL) + "."};
  var ev = DY.evalOffer(p, {tid:t.id, sal:sal, type:type}, {week:g.week, ext:true});
  g.ext[pid] = {sal:sal, type:type, status:"pending", tone:ev.tone, why:ev.why, wk:g.week, tid:t.id};
  return {ok:true, ev:ev};
};
function nextYearSpace(t, extra){ var ps = sum(t.roster.map(function(id){ var p = G().P[id], c = p.con; if (!c) return 0; if (G().ext[id] && G().ext[id].status === "signed") return G().ext[id].sal; return c.yrs >= 2 || (c.opt && c.yrs <= 1) ? c.sal : 0; })); return t.budget - ps - (extra || 0); }
DY.processExtensions = function(){
  var g = G();
  Object.keys(g.ext).forEach(function(pid){
    var x = g.ext[pid], p = g.P[pid]; if (x.status !== "pending" || !p || p.team !== x.tid) return;
    var ev = DY.evalOffer(p, {tid:x.tid, sal:x.sal, type:x.type}, {week:g.week, ext:true}), r = ev.score + gauss() * 0.15;
    if (r > 0.1){ x.status = "signed"; p.ext = {sal:x.sal, type:x.type}; p.rel = clamp(p.rel + 6, 0, 100); DY.addLog(p, "Agreed to an extension: " + DY.money(x.sal) + ", " + DY.CON_TYPES[x.type] + ".");
      DY.news("move", p.n + " extends with " + g.teams[x.tid].name, p.n + " is staying put: " + DY.money(x.sal) + ", " + DY.CON_TYPES[x.type] + ". " + (p.pri.loyal > .3 ? "Loyalty still means something in this league." : "Business is business, and business is GOOD."), {pid:+pid, tid:x.tid});
      DY.tx(g.teams[x.tid].abbr + " extended " + p.n + " (" + DY.money(x.sal) + ", " + DY.CON_TYPES[x.type] + ")", [x.tid]); }
    else if (r < -0.55 || (g.week >= 5 && r < 0)){ x.status = "broken"; p.rel = clamp(p.rel - 3, 0, 100); DY.addLog(p, "Extension talks with " + g.teams[x.tid].name + " broke off."); }
    else { x.tone = ev.tone; x.why = ev.why; }
  });
};
DY.cpuExtensions = function(){
  var g = G();
  g.teams.forEach(function(t){
    if (t.user && !g.settings.auto) return;
    t.roster.forEach(function(id){
      var p = g.P[id]; if (!DY.extEligible(p) || g.ext[id]) return;
      // home-grown players and "keep the core" front offices get priority
      var home = p.drafted && p.drafted.tid === t.id, core = t.plan === "core";
      if (home ? DY.knownOvr(p) < 75 && DY.knownCeil(p) < 85 : p.ovr < 80) return;
      if (!chance(home ? 0.8 : core ? 0.6 : 0.35)) return;
      var keep = home || (t.tag === "Rebuilding" || t.plan === "draft" ? p.age <= 25 : p.ovr >= 82); if (!keep) return;
      var ask = DY.askFor(p, t.id), sal = Math.round(Math.min(DY.MAX_SAL, ask * (home ? rr(1.0, 1.1) : rr(0.95, 1.05))) / 5) * 5, type = DY.cpuType(t, p);
      if (nextYearSpace(t, sal) < 0) return;
      g.ext[id] = {sal:sal, type:type, status:"pending", wk:g.week, tid:t.id};
    });
  });
};
DY.applyExtensions = function(){ // at season end: signed extensions become the new contract
  var g = G();
  Object.keys(g.ext).forEach(function(pid){ var x = g.ext[pid], p = g.P[pid]; if (x.status === "signed" && p && p.team === x.tid){ p.con = DY.newCon(x.sal, x.type, x.tid); p.con.fresh = 1; } });
  DY.allP().forEach(function(p){ p.ext = null; });
  g.ext = {};
};

/* =====================================================================================
   TRADES
   ===================================================================================== */
var TAG_W = {Contender:{tal:1.0, fin:0.22, youth:0.4, cash:0.75}, Buying:{tal:0.9, fin:0.42, youth:0.8, cash:0.95}, Rebuilding:{tal:0.55, fin:0.8, youth:1.6, cash:1.25}};
DY.TAGS = ["Contender", "Buying", "Rebuilding"];
DY.TAG_TEXT = {Contender:"Confident in the lineup. Only big upgrades move the needle.", Buying:"Close. Open to buying talent from teams that are selling.", Rebuilding:"Starting fresh. Will sell veterans for youth, potential and cash."};
function needMult(p, t, outIds){
  var g = G(), ids = t.roster.filter(function(i){ return (outIds || []).indexOf(i) < 0; }), c = DY.roleCounts(ids), m = 1;
  if (p.role === "AR" && c.ar + c.fx < 2) m += 0.12; if (p.role === "SMG" && c.smg + c.fx < 2) m += 0.12;
  if (ids.length){ var worst = DY.MODES.map(function(md){ return [md, DY.modeRating(t, md)]; }).sort(function(a, b){ return a[1] - b[1]; })[0][0], k = worst === "HP" ? "hp" : worst === "SND" ? "snd" : "ctl"; if (p.at[k] - p.ovr >= 2) m += 0.07; }
  return m;
}
DY.tradeValue = function(p, t, outIds){
  var w = TAG_W[t.tag] || TAG_W.Buying, ko = DY.knownOvr(p), adj = ko;
  if (p.age <= 23) adj += (DY.knownCeil(p) - ko) * 0.35 * w.youth;
  if (p.age >= 29) adj -= (p.age - 28) * 0.7 * (t.tag === "Rebuilding" ? 1.6 : 1);
  adj += DY.recentHardware(p) * 0.5;
  var talent = DY.salaryFor(adj) + 20, sal = p.con ? p.con.sal : DY.MIN_SAL, yrs = p.con ? p.con.yrs + (p.con.opt && DY.ctype(p.con.type).o === "T" ? 0.6 : p.con.opt ? 0.2 : 0) : 0.5;
  if (p.con && p.con.rookie && p.age <= 24) yrs += 0.8;      // cheap control + restricted free agency after
  var v = w.tal * talent * needMult(p, t, outIds) + w.fin * (talent - sal) * Math.max(0.5, yrs);
  if (p.trq && p.team === t.id) v *= 0.82;
  return Math.max(5, v);
};
DY.cashValue = function(c, t){ return c * (TAG_W[t.tag] || TAG_W.Buying).cash; };
// can these two rosters/budgets live with this deal? (cash > 0 means A sends cash to B). Items are player ids or "pk<team id>" draft picks.
DY.tradeLegal = function(A, B, giveA, giveB, cash){
  var g = G(), sa = DY.splitItems(giveA), sb = DY.splitItems(giveB);
  if (g.phase === "playoffs") return "Rosters are locked for the playoffs.";
  if (!giveA.length && !giveB.length) return "Add players or picks to the deal.";
  if (Math.abs(cash) > 300) return "Cash in a trade is capped at $300k.";
  if (sa.pk.length || sb.pk.length){
    if (!DY.picksTradable()) return "Draft picks can only be traded before the draft starts.";
    if (sa.pk.some(function(o){ return g.picks[o] !== A.id; }) || sb.pk.some(function(o){ return g.picks[o] !== B.id; })) return "A team can only trade picks it owns.";
  }
  if (sa.pl.some(function(i){ return A.roster.indexOf(i) < 0; }) || sb.pl.some(function(i){ return B.roster.indexOf(i) < 0; })) return "Those players aren't on those rosters.";
  var ra = A.roster.filter(function(i){ return sa.pl.indexOf(i) < 0; }).concat(sb.pl), rb = B.roster.filter(function(i){ return sb.pl.indexOf(i) < 0; }).concat(sa.pl);
  if (ra.length > DY.ROSTER || rb.length > DY.ROSTER) return "Rosters max out at " + DY.ROSTER + " players.";
  if (g.phase === "season" || g.phase === "preseason"){
    // games are being played: both teams must still be able to field a lineup
    if (ra.length < 4 || rb.length < 4) return "During the season both teams need at least 4 players after the trade.";
    if (!DY.canField(ra)) return A.name + " would not have 2 ARs and 2 SMGs.";
    if (!DY.canField(rb)) return B.name + " would not have 2 ARs and 2 SMGs.";
  } else {
    // offseason: rosters can be short, as long as the open spots can still get them to 2 ARs + 2 SMGs
    if (!DY.roleFeasible(ra)) return A.name + " couldn't get back to 2 ARs and 2 SMGs with the spots left.";
    if (!DY.roleFeasible(rb)) return B.name + " couldn't get back to 2 ARs and 2 SMGs with the spots left.";
  }
  var pay = function(ids, t){ return sum(ids.map(function(i){ var c = g.P[i].con; return c ? c.sal : 0; })) + (g.phase === "offseason" ? (t.deadNext || 0) : (t.dead || 0)) + DY.scoutCost(t); };
  if (pay(ra, A) > DY.spendLimit(A) - cash) return A.name + " can't fit that payroll in its budget.";
  if (pay(rb, B) > DY.spendLimit(B) + cash) return B.name + " can't fit that payroll in its budget.";
  if (sa.pl.concat(sb.pl).some(function(i){ var p = g.P[i]; return p.signedWk && p.signedWk === g.season * 100 + (g.phase === "offseason" ? 90 : g.week); })) return "Players signed this week can't be traded yet.";
  return null;
};
// what a team thinks a package is worth. Receiving several players is worth less than the sum: there are only so many roster spots,
// and a player who wouldn't crack the lineup barely moves the needle (no turning three scrubs into a star).
var DEPTH_W = [1, 0.62, 0.38, 0.25, 0.2];
DY.itemValue = function(x, t, outIds){ return DY.isPick(x) ? DY.pickValue(DY.pickOrig(x), t) : DY.tradeValue(G().P[x], t, outIds); };
DY.pkgValue = function(items, t, outIds, receiving){
  var g = G(), sp = DY.splitItems(items), pv = sum(sp.pk.map(function(o){ return DY.pickValue(o, t); }));
  if (!receiving) return pv + sum(sp.pl.map(function(i){ return DY.tradeValue(g.P[i], t, outIds); }));
  var keep = t.roster.filter(function(i){ return (outIds || []).indexOf(i) < 0; }), lineup = DY.bestLineup(keep.length >= 4 ? keep : keep), floor = lineup.length >= 4 ? Math.min.apply(null, lineup.map(function(i){ return DY.knownOvr(g.P[i]); })) : 0;
  var vals = sp.pl.map(function(i){ var p = g.P[i], v = DY.tradeValue(p, t, outIds); var young = p.age <= 23 && t.tag === "Rebuilding"; if (DY.knownOvr(p) < floor - 3 && !young) v *= 0.6; return v; }).sort(function(a, b){ return b - a; });
  return pv + sum(vals.map(function(v, i){ return v * DEPTH_W[Math.min(i, DEPTH_W.length - 1)]; }));
};
// B's answer to an offer from A
DY.evalTrade = function(A, B, giveA, giveB, cash){
  var g = G(), err = DY.tradeLegal(A, B, giveA, giveB, cash); if (err) return {ok:false, msg:err};
  var outB = DY.splitItems(giveB).pl;
  var gain = DY.pkgValue(giveA, B, outB, true) + DY.cashValue(cash, B), loss = DY.pkgValue(giveB, B, null, false);
  var margin = B.tag === "Contender" ? 0.12 : B.tag === "Buying" ? 0.06 : 0.03;
  if (B.rivals.indexOf(A.id) >= 0) margin += 0.08;
  // contenders protect their core: losing a top-2 player hurts more
  var core = DY.bestLineup(B.roster).slice().sort(function(a, b){ return g.P[b].ovr - g.P[a].ovr; }).slice(0, 2);
  if (B.tag === "Contender" && outB.some(function(i){ return core.indexOf(i) >= 0; })) margin += 0.1;
  // consolidation: giving up the best player in the deal needs a real centerpiece coming back
  var bestOut = Math.max.apply(null, outB.map(function(i){ return DY.tradeValue(g.P[i], B); }).concat([0])), bestIn = Math.max.apply(null, DY.splitItems(giveA).pl.map(function(i){ return DY.tradeValue(g.P[i], B, outB); }).concat(DY.splitItems(giveA).pk.map(function(o){ return DY.pickValue(o, B); })).concat([0]));
  var star = bestOut > bestIn * 1.35 && bestOut > 150;
  if (star) margin += 0.18;
  var need = loss * (1 + margin) + 10, ratio = gain / Math.max(1, loss);
  var ok = gain >= need;
  var msg = ok ? B.name + " accept." : B.name + " decline: " + (star && ratio >= 0.8 ? "quantity isn't quality — they want a real centerpiece back for their best player." : ratio < 0.7 ? "not close." : ratio < 0.95 ? "they want more value back." : "close — sweeten it a little.") + (B.rivals.indexOf(A.id) >= 0 ? " (Pool rivals ask for a premium.)" : "");
  return {ok:ok, msg:msg, gain:gain, loss:loss, need:need, ratio:ratio};
};
DY.doTrade = function(A, B, giveA, giveB, cash, quiet){
  var g = G(), sa = DY.splitItems(giveA), sb = DY.splitItems(giveB);
  A.roster = A.roster.filter(function(i){ return sa.pl.indexOf(i) < 0; }).concat(sb.pl);
  B.roster = B.roster.filter(function(i){ return sb.pl.indexOf(i) < 0; }).concat(sa.pl);
  sa.pk.forEach(function(o){ g.picks[o] = B.id; }); sb.pk.forEach(function(o){ g.picks[o] = A.id; });
  A.cashAdj = (A.cashAdj || 0) - cash; B.cashAdj = (B.cashAdj || 0) + cash;
  var stamp = g.season * 100 + (g.phase === "offseason" ? 90 : g.week);
  if (DY.leaveTeam){ sa.pl.forEach(function(i){ DY.leaveTeam(g.P[i], A.id, "trade"); }); sb.pl.forEach(function(i){ DY.leaveTeam(g.P[i], B.id, "trade"); }); }
  sa.pl.forEach(function(i){ var p = g.P[i]; p.team = B.id; p.con.by = B.id; p.rel = clamp(52 + gauss() * 6 + (p.trq ? 12 : 0), 25, 85); p.trq = 0; p.tenure = 0; p.signedWk = stamp; if (p.prevTeams.indexOf(B.id) < 0) p.prevTeams.push(B.id); DY.addLog(p, "Traded from " + A.name + " to " + B.name + "."); delete g.ext[i]; });
  sb.pl.forEach(function(i){ var p = g.P[i]; p.team = A.id; p.con.by = A.id; p.rel = clamp(52 + gauss() * 6 + (p.trq ? 12 : 0), 25, 85); p.trq = 0; p.tenure = 0; p.signedWk = stamp; if (p.prevTeams.indexOf(A.id) < 0) p.prevTeams.push(A.id); DY.addLog(p, "Traded from " + B.name + " to " + A.name + "."); delete g.ext[i]; });
  if (DY.meetTeam){ sa.pl.forEach(function(i){ DY.meetTeam(g.P[i], B.id); }); sb.pl.forEach(function(i){ DY.meetTeam(g.P[i], A.id); }); }
  A.lineup = A.lineup.filter(function(i){ return A.roster.indexOf(i) >= 0; }); B.lineup = B.lineup.filter(function(i){ return B.roster.indexOf(i) >= 0; });
  if (A.roster.length >= 4) DY.fixLineup(A); if (B.roster.length >= 4) DY.fixLineup(B);
  var nmL = function(items){ return items.map(DY.itemName).join(", "); };
  var desc = A.abbr + " send " + (giveA.length ? nmL(giveA) : "nothing") + (cash > 0 ? " + " + DY.money(cash) : "") + " to " + B.abbr + " for " + (giveB.length ? nmL(giveB) : "nothing") + (cash < 0 ? " + " + DY.money(-cash) : "");
  DY.tx("TRADE: " + desc, [A.id, B.id]);
  if (!quiet) DY.tradeNews(A, B, giveA, giveB, cash);
  g.offers = g.offers.filter(function(o){ return !o.give.concat(o.get).some(function(i){ return giveA.indexOf(i) >= 0 || giveB.indexOf(i) >= 0; }); });
};
DY.userTrade = function(tid, mine, theirs, cash){
  var g = G(), A = DY.userT(), B = g.teams[tid], ev = DY.evalTrade(A, B, mine, theirs, cash);
  if (ev.ok) DY.doTrade(A, B, mine, theirs, cash);
  return ev;
};
/* CPU teams build a deal for a target player. Returns {give, cash} or null. */
// value on a neutral scale (no team needs or strategy) — every CPU deal must look sane on this scale too
DY.neutralValue = function(p){
  var ko = DY.knownOvr(p), adj = ko + (p.age <= 23 ? (DY.knownCeil(p) - ko) * 0.3 : 0) - (p.age >= 29 ? (p.age - 28) * 0.6 : 0) + DY.recentHardware(p) * 0.5;
  var talent = DY.salaryFor(adj) + 20, sal = p.con ? p.con.sal : DY.MIN_SAL, yrs = p.con ? p.con.yrs + (p.con.opt ? 0.4 : 0) : 0.5;
  return Math.max(5, 0.9 * talent + 0.35 * (talent - sal) * Math.max(0.5, yrs));
};
DY.fairEnough = function(give, get, cashToGetter, minRatio){
  var g = G(), side = function(items){ var sp = DY.splitItems(items), vals = sp.pl.map(function(i){ return DY.neutralValue(g.P[i]); }).sort(function(a, b){ return b - a; }); return sum(sp.pk.map(DY.pickNeutral)) + sum(vals.map(function(v, i){ return v * DEPTH_W[Math.min(i, DEPTH_W.length - 1)]; })); };
  var a = side(give) + Math.max(0, cashToGetter), b = side(get) + Math.max(0, -cashToGetter);
  return a >= b * (minRatio || 0.85);
};
function buildPackage(buyer, seller, targetIds, maxCash){
  var g = G(), best = null, bestCost = 1e9;
  var cands = buyer.roster.filter(function(i){ return targetIds.indexOf(i) < 0; });
  // top-4 teams don't get to flip picks for more talent (keeps the rich from getting richer); everyone else can
  var rk = g.teams.filter(function(o){ return DY.teamRating(o) > DY.teamRating(buyer); }).length;
  if (DY.picksTradable() && !DY.NO_PK && (buyer.user || rk >= 4)) DY.picksOf(buyer.id).forEach(function(o){ cands.push("pk" + o); });
  var sets = [[]]; cands.forEach(function(i){ sets.push([i]); }); for (var x = 0; x < cands.length; x++) for (var y = x + 1; y < cands.length; y++) sets.push([cands[x], cands[y]]);
  sets.forEach(function(give){
    for (var cash = 0; cash <= maxCash; cash += 25){
      var ev = DY.evalTrade(buyer, seller, give, targetIds, cash); if (!ev.ok) continue;
      if (!DY.fairEnough(give, targetIds, cash, 0.85)) continue;
      var bv = DY.pkgValue(targetIds, buyer, DY.splitItems(give).pl, true), bc = DY.pkgValue(give, buyer, null, false) + DY.cashValue(cash, buyer);
      if (bv < bc * 1.03) break;
      var cost = bc; if (cost < bestCost){ bestCost = cost; best = {give:give, cash:cash}; }
      break;
    }
  });
  return best;
}
DY.cpuTrades = function(){
  var g = G(); if (g.phase === "playoffs") return;
  var buyers = shuffle(g.teams.filter(function(t){ return !t.user && t.tag !== "Rebuilding" && t.plan !== "draft"; })).sort(function(a, b){ return (b.plan === "trade") - (a.plan === "trade"); }), done = 0, maxT = (chance(0.55) ? rint(1, 2) : 0) + (buyers.some(function(t){ return t.plan === "trade"; }) && chance(0.5) ? 1 : 0);
  for (var bi = 0; bi < buyers.length && done < maxT; bi++){
    var B = buyers[bi]; if (B.roster.length < 4) continue;
    var lineup = DY.bestLineup(B.roster), weakest = lineup.slice().sort(function(a, b){ return g.P[a].ovr - g.P[b].ovr; })[0];
    var sellers = shuffle(g.teams.filter(function(t){ return !t.user && t.id !== B.id && (t.tag === "Rebuilding" || t.plan === "draft" || t.roster.some(function(i){ return g.P[i].trq; })); }));
    for (var si = 0; si < sellers.length; si++){
      var S = sellers[si]; if (S.roster.length < 4) continue;
      var targets = S.roster.map(function(i){ return g.P[i]; }).filter(function(p){ return p.ovr >= g.P[weakest].ovr + 2.5 && (S.tag === "Rebuilding" || S.plan === "draft" ? (p.age >= 25 && !(p.drafted && p.drafted.tid === S.id)) || p.trq : p.trq); }).sort(function(a, b){ return b.ovr - a.ovr; });
      var found = false;
      for (var ti = 0; ti < Math.min(3, targets.length); ti++){
        var pk = buildPackage(B, S, [targets[ti].id], Math.min(300, Math.max(0, DY.space(B))));
        if (pk && !DY.tradeLegal(B, S, pk.give, [targets[ti].id], pk.cash)){ DY.doTrade(B, S, pk.give, [targets[ti].id], pk.cash); done++; found = true; break; }
      }
      if (found) break;
    }
  }
};
// CPU teams pitch deals to the user. They watch the user's trade block (players you'll move) and target list (players you want).
DY.cpuOffersToUser = function(){
  var g = G(), u = DY.userT(); g.offers = []; g.block = g.block || []; g.targets = g.targets || [];
  if (g.phase === "playoffs" || u.roster.length < 4) return;
  var block = g.block.filter(function(i){ return u.roster.indexOf(i) >= 0; }), tg = g.targets.filter(function(i){ var p = g.P[i]; return p && p.team != null && p.team !== u.id; });
  if (!chance(block.length || tg.length ? 0.9 : 0.55)) return;
  var n = block.length + tg.length >= 2 ? 3 : chance(0.35) ? 2 : 1, used = {};
  var add = function(B, give, get, cash, why){ if (used[B.id] || g.offers.length >= n) return false; if (DY.tradeLegal(u, B, get, give, -cash)) return false; used[B.id] = 1; g.offers.push({id:g.season + "-" + (g.phase === "offseason" ? "o" + g.off.week : g.week) + "-" + B.id, tid:B.id, give:give, get:get, cash:cash, wk:g.week, why:why}); return true; };
  // 1) teams that own one of your targets offer him for something of yours
  shuffle(tg).forEach(function(tid){
    var p = g.P[tid], B = g.teams[p.team]; if (B.roster.length < 4 || used[B.id]) return;
    var mine = u.roster.slice().sort(function(a, b){ return (block.indexOf(b) >= 0) - (block.indexOf(a) >= 0) || DY.tradeValue(g.P[b], B) - DY.tradeValue(g.P[a], B); });
    for (var i = 0; i < mine.length; i++){ var give = [mine[i]]; for (var cash = 0; cash <= 150; cash += 50){ var ev = DY.evalTrade(u, B, give, [tid], cash); if (ev.ok && DY.fairEnough(give, [tid], cash, 0.92) && DY.fairEnough([tid], give, -cash, 0.75)){ if (add(B, [tid], give, -cash, "You listed " + p.n + " as a target.")) return; } } }
  });
  // 2) teams that like a player on your block (or anyone if you haven't listed)
  var pool = block.length ? block : u.roster.filter(function(i){ return DY.knownOvr(g.P[i]) >= 76; });
  shuffle(g.teams.filter(function(t){ return !t.user && t.roster.length >= 4; })).forEach(function(B){
    if (g.offers.length >= n || used[B.id]) return; if (B.rivals.indexOf(u.id) >= 0 && chance(0.6)) return;
    var want = pool.map(function(i){ return g.P[i]; }).filter(function(p){ return B.tag === "Rebuilding" ? p.age <= 25 || block.indexOf(p.id) >= 0 : true; }).sort(function(a, b){ return DY.tradeValue(b, B) - DY.tradeValue(a, B); });
    for (var w = 0; w < Math.min(2, want.length); w++){
      var target = want[w], pk = buildPackage(B, u, [target.id], Math.min(200, Math.max(0, DY.space(B))));
      if (pk && DY.fairEnough(pk.give, [target.id], pk.cash, 0.9) && DY.fairEnough([target.id], pk.give, -pk.cash, 0.78)){ if (add(B, pk.give, [target.id], pk.cash, block.indexOf(target.id) >= 0 ? target.n + " is on your trade block." : null)) break; }
    }
  });
};
DY.acceptOffer = function(oid){
  var g = G(), o = g.offers.find(function(x){ return x.id === oid; }); if (!o) return "That offer has expired.";
  var B = g.teams[o.tid], u = DY.userT(), err = DY.tradeLegal(u, B, o.get, o.give, -o.cash); if (err) return err;
  DY.doTrade(u, B, o.get, o.give, -o.cash); g.offers = g.offers.filter(function(x){ return x.id !== oid; }); return null;
};

/* =====================================================================================
   TEAM STRATEGY TAGS
   ===================================================================================== */
DY.setTags = function(initial){
  var g = G(), sc = g.teams.map(function(t){ var gp = t.w + t.l, wp = gp ? t.w / gp : 0.5; var ages = t.roster.map(function(i){ return g.P[i].age; }); return {t:t, v:DY.teamRating(t, DY.bestLineup(t.roster)) + (gp ? (wp - 0.5) * 8 : 0) - (mean(ages) > 28 ? 0.5 : 0)}; }).sort(function(a, b){ return b.v - a.v; });
  sc.forEach(function(x, i){
    var t = x.t, old = t.tag;
    var tag = i < 4 ? "Contender" : i >= 12 ? "Rebuilding" : "Buying";
    if (i >= 10 && i < 12 && chance(0.35)) tag = "Rebuilding";
    if (i >= 12 && t.style === "stars" && chance(0.4)) tag = "Buying";
    if (t.user){ if (!t.userTag) t.tag = tag; t.suggest = tag; return; }
    t.tag = tag;
    // front-office plans shift with results: a rebuild that worked turns into "keep the core"; a team stuck at the bottom commits to the draft
    if (!initial && DY.PLAN_NAME){ var was = t.plan;
      if (t.plan === "draft" && i < 6) t.plan = "core";
      else if (i >= 12 && t.plan !== "draft" && chance(0.3)) t.plan = "draft";
      else if (chance(0.06)) t.plan = DY.randPlan();
      if (was !== t.plan) DY.news("league", t.name + ": new direction", t.name + " are now " + DY.PLAN_NAME[t.plan].toLowerCase() + ". " + DY.PLAN_TEXT[t.plan], {tid:t.id}); }
    if (!initial && old && old !== tag && (tag === "Rebuilding" || old === "Rebuilding")) DY.news("league", t.name + " " + (tag === "Rebuilding" ? "hit the reset button" : "are buyers again"), tag === "Rebuilding" ? "Front office sources say " + t.name + " are open for business. Veterans, check your phones." : t.name + " think they're close. They're shopping.", {tid:t.id});
  });
};

/* =====================================================================================
   WEEKLY MARKET: relationships, trade requests, CPU signings & trades, offers to the user, extensions
   ===================================================================================== */
DY.weeklyMarket = function(){
  var g = G();
  // moods, trade requests and locker room drama (dyn-life.js)
  DY.moodWeek();
  DY.lockerRoom();
  if (g.week === 3) DY.setTags(false);
  DY.cpuInSeasonSignings();
  DY.cpuTrades();
  DY.cpuOffersToUser();
  if (g.week >= 3){ DY.cpuExtensions(); DY.processExtensions(); }
};
DY.cpuInSeasonSignings = function(){
  var g = G(), done = 0;
  shuffle(g.teams.filter(function(t){ return !t.user || g.settings.auto; })).forEach(function(t){
    if (done >= 2 || t.w > t.l || !chance(0.3)) return;
    var sub = DY.sub(t), worst = sub != null ? g.P[sub] : null; if (!worst) return;
    var fas = DY.active().filter(function(p){ return p.team == null && p.st && p.st.mi.m >= 6 && !DY.hiddenOvr(p); }).map(function(p){ return {p:p, so:DY.seasonOvr(p.st.mi)}; }).filter(function(x){ return x.p.ovr >= worst.ovr + 3 && x.so >= 82 && x.p.role === worst.role; }).sort(function(a, b){ return b.p.ovr - a.p.ovr; });
    var f = fas[0]; if (!f) return;
    var ask = DY.askFor(f.p, t.id); if (ask > DY.space(t) - 0) return;
    if (DY.evalOffer(f.p, {tid:t.id, sal:ask, type:"1+1T"}, {week:3}).score < -0.1) return;
    DY.release(worst.id, true); DY.signPlayer(f.p, t.id, ask, "1+1T"); done++;
    DY.news("move", t.name + " call up " + f.p.n, t.name + " cut " + worst.n + " and bring up " + f.p.n + " from the Academy (" + DY.kd(f.p.st.mi.k, f.p.st.mi.d).toFixed(2) + " K/D down there). Earned, not given.", {pid:f.p.id, tid:t.id});
  });
};

/* =====================================================================================
   FAN ENGAGEMENT + BUDGETS
   ===================================================================================== */
DY.updateFans = function(){
  var g = G();
  g.teams.forEach(function(t){
    var gp = t.w + t.l, wp = gp ? t.w / gp : 0.5, star = Math.max.apply(null, t.roster.map(function(i){ return g.P[i].ovr; }).concat([70]));
    var target = 50 + (wp - 0.5) * 46 + (star - 86) * 1.1 + (t.mkt - 1) * 28 + Math.min(10, (t.titlesRecent || 0) * 4);
    var last = t.wk.slice(-2), bump = last.filter(function(x){ return x === "W"; }).length * 0.8 - last.filter(function(x){ return x === "L"; }).length * 0.7;
    t.fan.eng = clamp(t.fan.eng + (target - t.fan.eng) * 0.16 + bump, 4, 99);
  });
};
DY.fanMetrics = function(t){ var e = t.fan.eng; return {eng:Math.round(e), viewers:Math.round(Math.pow(e, 1.55) * 2.1 * t.mkt / 10) * 10, merch:Math.round(e * t.mkt * 2.6), social:Math.round(e * t.mkt * 880 / 100) * 100}; };
DY.seasonEndFans = function(){
  var g = G(), fin = g.po.fin;
  g.teams.forEach(function(t){
    var f = fin[t.id], b = f === 1 ? 12 : f === 2 ? 7 : f <= 4 ? 4 : f <= 8 ? 1.5 : f <= 12 ? -1 : -6;
    t.fan.eng = clamp(t.fan.eng + b + (t.fan.base - t.fan.eng) * 0.1, 4, 99);
    t.titlesRecent = (t.titlesRecent || 0) * 0.6 + (f === 1 ? 1 : 0);
    var po = f === 1 ? 110 : f === 2 ? 70 : f <= 4 ? 45 : f <= 8 ? 25 : f <= 12 ? 10 : 0;
    var calc = 760 + t.fan.eng * 10 * (0.85 + t.mkt * 0.15) + po * 1.2;
    var nb = Math.round(clamp(t.budget * 0.35 + calc * 0.65 - (t.taxNext || 0), DY.BUDGET_MIN - 100, DY.BUDGET_MAX) / 25) * 25;
    t.taxPaid = t.taxNext || 0; t.taxNext = 0;
    t.budgetPrev = t.budget; t.budgetRaw = nb;
  });
  // revenue sharing: part of every team's revenue goes into a league pool that's split evenly
  var mean0 = mean(g.teams.map(function(t){ return t.budgetRaw; }));
  g.teams.forEach(function(t){ var nb = t.budgetRaw * (1 - DY.REV_SHARE) + mean0 * DY.REV_SHARE; t.shareIn = Math.round(nb - t.budgetRaw); t.budget = Math.round(clamp(nb, DY.BUDGET_MIN - 100, DY.BUDGET_MAX) / 25) * 25; });
  g.teams.forEach(function(t){ delete t.budgetRaw; });
};
})(typeof window !== "undefined" ? window : globalThis);
