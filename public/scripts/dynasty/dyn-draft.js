/* DYNASTY: scouting (weekly points), draft picks (tradable), the rookie draft (bottom-4 lottery, open-spot entry),
   rookie signing negotiations, and players who evolve over time (traits, playstyle, priorities). Pure engine code. */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, rint = DY.rint, rr = DY.rr, pick = DY.pick, shuffle = DY.shuffle, chance = DY.chance, wpick = DY.wpick, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };
var hg = DY.hg, hn = DY.hn;
var nm = function(id){ var p = G().P[id]; return p ? p.n : "?"; };

/* =====================================================================================
   SCOUTING DEPARTMENT — costs budget, earns scouting points every week.
   Spend a point on a prospect to learn one more layer about him. Reads are good, never perfect.
   ===================================================================================== */
DY.SCOUT = [
  {n:"None", c:0, pts:2, txt:"No real staff. 2 scouting points a week."},
  {n:"Basic", c:25, pts:4, txt:"One scout. 4 scouting points a week."},
  {n:"Strong", c:50, pts:6, txt:"A real department. 6 scouting points a week."},
  {n:"Elite", c:90, pts:9, txt:"The best department in the league. 9 scouting points a week."}];
DY.SCOUT_STEPS = ["Overall range and personality", "Potential range", "Skillset and work habits", "Deep dive: tight ranges, plus red flags or a generational talent"];
DY.SP_CAP = 40;
DY.scoutCost = function(t){ return DY.SCOUT[t.scout || 0].c; };
DY.setScout = function(lv){
  var g = G(), t = DY.userT(); lv = +lv;
  if (!DY.SCOUT[lv]) return "Pick a scouting level.";
  if (g.phase !== "preseason") return "Scouting budgets are set in the preseason.";
  var d = DY.SCOUT[lv].c - DY.scoutCost(t); if (d > 0 && d > DY.space(t)) return "Not enough budget space for that level.";
  t.scout = lv; return null;
};
DY.cpuScouting = function(){
  var g = G();
  g.teams.forEach(function(t){
    if (t.user && !g.settings.auto) return;
    var want = t.plan === "draft" || t.tag === "Rebuilding" ? 3 : t.plan === "fa" ? 1 : t.tag === "Buying" ? 2 : 1;
    if (t.tag === "Contender" && DY.space(t) < 120) want = 0;
    while (want > 0 && DY.SCOUT[want].c - DY.scoutCost(t) > DY.space(t)) want--;
    t.scout = want;
  });
};
DY.scoutLvl = function(p, tid){ var g = G(); return (g.scout && g.scout[tid] && g.scout[tid][p.id]) || 0; };
DY.ensureClass = function(){
  var g = G(); if (g.phase === "offseason" || g.phase === "draft") return;
  if (!DY.prospects().some(function(p){ return p.rookie.cls === g.season + 1; })) DY.rookieClass(true);
};
DY.classNow = function(){ var g = G(); if (g.phase === "offseason") return (g.off.rookies || []).map(function(id){ return g.P[id]; }).filter(function(p){ return p && p.rookie && p.rookie.hidden && p.status !== "retired"; }); return DY.prospects(); };
DY.scoutProspect = function(pid, tid){
  var g = G(); tid = tid == null ? g.user : tid; var t = g.teams[tid], p = g.P[pid];
  if (!p || !p.rookie || !p.rookie.hidden) return "He's not a prospect.";
  if (g.phase === "offseason" && g.off.stage !== "recap" && g.off.stage !== "options") return "Scouting is closed once the draft starts.";
  var lv = DY.scoutLvl(p, tid); if (lv >= 4) return "Your scouts already know everything they can.";
  if ((t.sp || 0) < 1) return "No scouting points left. You earn more every week.";
  t.sp -= 1; g.scout = g.scout || {}; g.scout[tid] = g.scout[tid] || {}; g.scout[tid][pid] = lv + 1; return null;
};
function cpuScout(t){
  var g = G(), cls = DY.classNow(); if (!cls.length) return;
  var deep = t.tag === "Rebuilding" || (DY.picksOf(t.id).some(function(o){ return DY.projSlot(o) <= 5; }));
  var guard = 0;
  while ((t.sp || 0) >= 1 && guard++ < 60){
    var best = null, bs = 1e9;
    cls.forEach(function(p, i){ var lv = DY.scoutLvl(p, t.id); if (lv >= 4) return; var s = deep ? lv * 0.6 + i * 0.5 : lv * 1.6 + i * 0.25; s += hn(p.id * 3.1 + t.id * 7.7) * 0.8; if (s < bs){ bs = s; best = p; } });
    if (!best) break; DY.scoutProspect(best.id, t.id);
  }
}
DY.weeklyScouting = function(){
  var g = G(); DY.ensureClass();
  g.teams.forEach(function(t){ t.sp = Math.min(DY.SP_CAP, (t.sp || 0) + DY.SCOUT[t.scout || 0].pts); if (!t.user || g.settings.auto) cpuScout(t); });
};
// What one team's scouts believe about a prospect. Deterministic per team + prospect, so reads never flicker.
DY.scoutView = function(p, tid){
  if (!p || !p.rookie) return null;
  var lv = DY.scoutLvl(p, tid), a = p.rookie.arche, out = {lvl:lv, consensus:{rank:p.rookie.rank, est:p.rookie.est}};
  if (lv < 1){ out.est = p.rookie.est; out.estC = p.rookie.estC; return out; }
  var sd = [0, 3.6, 2.6, 2.1, 1.3][lv], bm = [1, 1, 0.75, 0.55, 0.3][lv], seed = p.id * 7.13 + tid * 1.7;
  var bias = (a === "gem" ? -5 : a === "bust" ? 5 : 0) * bm, cb = (a === "gem" ? -7 : a === "bust" ? 8 : 0) * bm;
  out.est = clamp(p.ovr + hg(seed + 3) * sd + bias, 55, 95);
  out.estC = clamp(p.ceil + hg(seed + 11) * sd * 1.15 + cb, out.est, 99);
  var w = [6, 5, 4, 3, 2][lv]; out.lo = Math.round(out.est) - w; out.hi = Math.round(out.est) + w;
  if (lv >= 2){ out.gLo = DY.gradeFor(out.estC - (lv >= 4 ? 0 : 3)); out.gHi = DY.gradeFor(out.estC + (lv >= 4 ? 0 : 3)); out.grade = DY.gradeFor(out.estC); }
  if (lv >= 3){ out.skills = {}; DY.ATTR.forEach(function(k, i){ var e = p.at[k] + hg(seed + 20 + i) * (lv >= 4 ? 1.6 : 2.6); out.skills[k] = [Math.round(clamp(e - 3, 40, 96)), Math.round(clamp(e + 3, 43, 99))]; });
    out.notes = []; if (p.work >= 80) out.notes.push("Gym rat — elite work ethic"); else if (p.work <= 55) out.notes.push("Questions about his work ethic");
    if (p.clutch >= 75) out.notes.push("Big-moment player"); if (p.cons <= 48) out.notes.push("Streaky"); if (p.chem <= 45) out.notes.push("Can be hard to play with"); if (p.chem >= 82) out.notes.push("Great teammate"); }
  if (lv >= 4){
    var r = hn(p.id * 5.3 + tid * 9.1);
    if (a === "gen") out.flag = r < 0.9 ? "Generational talent" : "Future star";
    else if (a === "star") out.flag = r < 0.75 ? "Future star" : r < 0.82 ? "Generational talent" : null;
    else if (a === "bust") out.flag = r < 0.7 ? "Red flags" : null;
    else if (a === "gem") out.flag = r < 0.6 ? "Sleeper" : null;
    else if (r < 0.05) out.flag = "Sleeper";
  }
  return out;
};

/* =====================================================================================
   DRAFT PICKS — one first-round pick per team for the next draft. Tradable until the draft starts.
   ===================================================================================== */
DY.resetPicks = function(){ var g = G(); g.picks = {}; g.teams.forEach(function(t){ g.picks[t.id] = t.id; }); };
DY.picksOf = function(tid){ var g = G(); return Object.keys(g.picks || {}).map(Number).filter(function(o){ return g.picks[o] === tid; }); };
DY.picksTradable = function(){ var g = G(); return g.phase !== "playoffs" && g.phase !== "draft" && !(g.phase === "offseason" && g.off && ["recap", "options"].indexOf(g.off.stage) < 0); };
// teams ordered worst → best by regular-season record (live during the season, final once it's over)
DY.recordOrder = function(){
  var g = G(), rows;
  if (g.phase === "offseason" || (g.phase === "preseason" && false)) rows = g.hist[g.hist.length - 1].stand.map(function(r){ return {id:r.id, w:r.w, l:r.l, md:r.mw - r.ml, mw:r.mw}; });
  else if (g.phase === "preseason" || (g.phase === "season" && g.round === 0)) return (g.pr || g.teams.map(function(t){ return t.id; })).slice().reverse();
  else rows = g.teams.map(function(t){ return {id:t.id, w:t.w, l:t.l, md:t.mw - t.ml, mw:t.mw}; });
  return rows.sort(function(a, b){ return (a.w - a.l) - (b.w - b.l) || a.md - b.md || a.mw - b.mw || a.id - b.id; }).map(function(r){ return r.id; });
};
DY.projSlot = function(orig){ var g = G(), d = g.off && g.off.draft; if (d){ var i = d.slots.findIndex(function(s){ return s.orig === orig; }); if (i >= 0) return i + 1; } return DY.recordOrder().indexOf(orig) + 1; };
// only the 8 worst records draft; the 4 worst are in the lottery for picks 1-4 (odds at #1 below; picks 2-4 drawn with the same weights)
DY.DRAFT_TEAMS = 8; DY.LOTTO_TEAMS = 4;
DY.LOTTO_W = [60, 20, 12.5, 7.5];
DY.lotteryOdds = function(){ return DY.recordOrder().slice(0, DY.LOTTO_TEAMS).map(function(id, i){ return {tid:id, w:DY.LOTTO_W[i]}; }); };
// a pick's worth by where its original team sits: bottom 8 = a real pick, 9-12 = a long shot, top 4 = basically nothing
function slotWorth(s){ if (s > 12) return 1; if (s > DY.DRAFT_TEAMS) return 8; return 30 + 160 * Math.pow((DY.DRAFT_TEAMS + 1 - s) / DY.DRAFT_TEAMS, 1.5); }    // #1 ≈ $190k, #8 ≈ $37k
DY.pickValue = function(orig, t){
  var s = DY.projSlot(orig), v = slotWorth(s), g = G();
  v *= t.tag === "Rebuilding" ? 1.3 : t.tag === "Contender" ? 0.85 : 0.95;
  v *= t.plan === "draft" ? 1.35 : t.plan === "trade" ? 1.1 : t.plan === "fa" ? 0.85 : 1;
  var rk = g.teams.filter(function(o){ return DY.teamRating(o) > DY.teamRating(t); }).length + 1;     // weaker teams want picks more
  v *= 0.85 + rk / 16 * 0.35;
  return DY.projSlot(orig) > DY.DRAFT_TEAMS ? v : Math.max(15, v);
};
DY.pickNeutral = function(orig){ return slotWorth(DY.projSlot(orig)) * 0.85; };
DY.pickName = function(orig){ var g = G(), s = DY.projSlot(orig); return "S" + (g.season + 1) + " pick (" + g.teams[orig].abbr + (s > DY.DRAFT_TEAMS ? ", only if they finish bottom 8" : ", proj. #" + s) + ")"; };
DY.isPick = function(x){ return typeof x === "string" && x.indexOf("pk") === 0; };
DY.pickOrig = function(x){ return +String(x).slice(2); };
DY.splitItems = function(arr){ var pl = [], pk = []; (arr || []).forEach(function(x){ if (DY.isPick(x)) pk.push(DY.pickOrig(x)); else pl.push(+x); }); return {pl:pl, pk:pk}; };
DY.itemName = function(x){ return DY.isPick(x) ? DY.pickName(DY.pickOrig(x)) : nm(x); };

/* =====================================================================================
   ROOKIE DRAFT
   Order: picks 1-4 by lottery among the 4 worst records (40/30/20/10% at #1); then everyone else by record.
   Only teams with an open roster spot enter (a spot per pick). A team that can't pick is skipped.
   ===================================================================================== */
DY.rightsHeld = function(tid){ return DY.active().filter(function(p){ return p.draftRights && p.draftRights.tid === tid; }).length; };
DY.freeSpots = function(t){ return DY.ROSTER - t.roster.length - DY.rightsHeld(t.id); };
DY.draftClass = function(){ var g = G(); return (g.off && g.off.rookies || []).map(function(id){ return g.P[id]; }).filter(function(p){ return p && p.status === "fa" && p.team == null && !p.draftRights && p.draftDeclined == null && !p.undrafted; }); };
// a team thinking about the draft: rebuilding, or holding a top-5 pick
DY.draftMinded = function(t){ return DY.picksOf(t.id).some(function(o){ var s = DY.projSlot(o); return s <= 5 || ((t.tag === "Rebuilding" || t.plan === "draft") && s <= DY.DRAFT_TEAMS); }); };
DY.weakestOption = function(tid){ var g = G(), best = null; Object.keys(g.off.opts || {}).forEach(function(id){ var o = g.off.opts[id], p = g.P[id]; if (o.tid !== tid || DY.ctype(o.type).o !== "T") return; if (!best || DY.knownOvr(p) < DY.knownOvr(best)) best = p; }); return best ? best.id : null; };
function keepValue(t, q){ var rb = t.tag === "Rebuilding", v = DY.knownOvr(q); if (q.age <= 23) v += (DY.knownCeil(q) - DY.knownOvr(q)) * (rb ? 0.6 : 0.3); if (rb && q.age >= 28) v -= (q.age - 27) * 1.2; return v; }
DY.boardValue = function(t, p){
  var sv = DY.scoutView(p, t.id), rb = t.tag === "Rebuilding", wc = rb ? 0.7 : t.tag === "Contender" ? 0.45 : 0.55;
  var v = sv.est * (1 - wc) + sv.estC * wc - (sv.lvl < 1 ? 1.5 : 0);
  if (sv.flag === "Generational talent") v += rb ? 6 : 3.5; else if (sv.flag === "Future star") v += 1.5; else if (sv.flag === "Red flags") v -= 3.5; else if (sv.flag === "Sleeper") v += 1.5;
  var c = DY.roleCounts(t.roster); if ((p.role === "AR" && c.ar + c.fx < 2) || (p.role === "SMG" && c.smg + c.fx < 2)) v += 1.5;
  return v;
};
DY.draftBoard = function(tid){ var t = G().teams[tid]; return DY.draftClass().map(function(p){ return {p:p, v:DY.boardValue(t, p)}; }).sort(function(a, b){ return b.v - a.v; }); };
// CPU teams that hold a pick but have no open spot decide whether the prospect is worth cutting someone for
DY.cpuMakeRoom = function(t, slotIdx){
  if (DY.freeSpots(t) > 0) return false;
  var board = DY.draftBoard(t.id), best = board[0]; if (!best) return false;
  var g = G(), sv = DY.scoutView(best.p, t.id), gen = sv.flag === "Generational talent";
  var worst = t.roster.map(function(i){ return g.P[i]; }).sort(function(a, b){ return keepValue(t, a) - keepValue(t, b); })[0];
  if (!worst) return false;
  var wv = keepValue(t, worst), rb = t.tag === "Rebuilding";
  var go = (gen && slotIdx < 6 && wv < 90) || ((rb || slotIdx < 4) && best.v >= wv + (rb ? -1 : 2));
  if (!go || !DY.roleFeasible(t.roster.filter(function(i){ return i !== worst.id; }))) return false;
  DY.release(worst.id, true);
  DY.news("draft", t.name + " clear a spot for the draft", t.name + " release " + worst.n + " to get into the draft at #" + (slotIdx + 1) + "." + (gen ? " Their scouts think there's a GENERATIONAL talent in this class. Make of that what you will." : " They like this class."), {tid:t.id, pid:worst.id});
  return true;
};
DY.startRookieDraft = function(){
  var g = G(); if (!g.off || g.off.stage !== "options") return;
  DY.pendingUserOptions().forEach(function(id){ DY.userOption(id, true); });
  if (!g.picks) DY.resetPicks();
  var rec = DY.recordOrder(), pool = rec.slice(0, DY.LOTTO_TEAMS).map(function(id, i){ return {id:id, w:DY.LOTTO_W[i], pre:i + 1}; }), order = [], lotto = [];
  for (var k = 0; k < 4; k++){ var x = wpick(pool, function(z){ return z.w; }); pool.splice(pool.indexOf(x), 1); order.push(x.id); lotto.push({orig:x.id, pre:x.pre, pick:k + 1}); }
  pool.sort(function(a, b){ return a.pre - b.pre; }).forEach(function(x){ order.push(x.id); lotto.push({orig:x.id, pre:x.pre, pick:order.length}); });
  rec.slice(DY.LOTTO_TEAMS, DY.DRAFT_TEAMS).forEach(function(id){ order.push(id); });
  g.off.draft = {slots:order.map(function(o){ return {orig:o, owner:g.picks[o]}; }), lotto:lotto, n:0, picks:[]};
  g.off.stage = "draft";
  g.off.draft.slots.forEach(function(sl, i){ var t = g.teams[sl.owner]; if (t.user && !g.settings.auto) return; DY.cpuMakeRoom(t, i); });
  var jump = lotto.filter(function(x){ return x.pick < x.pre; }).sort(function(a, b){ return (b.pre - b.pick) - (a.pre - a.pick); })[0];
  DY.news("draft", "Draft lottery: " + g.teams[order[0]].name + " win the #1 pick", "The ping pong balls have spoken. " + g.teams[order[0]].name + " pick first" + (jump && jump.pre - jump.pick >= 2 ? ", and " + g.teams[jump.orig].name + " jumped from #" + jump.pre + " to #" + jump.pick + "!" : ".") + " Top four: " + order.slice(0, 4).map(function(id, i){ return (i + 1) + ". " + g.teams[id].abbr; }).join(", ") + ".  Only the 8 worst records draft; everyone else's rookies come from free agency. Teams without an open roster spot sit out. " + pick(["Tank commanders, rejoice.", "The lottery giveth.", "Somebody's front office is popping champagne."]), {tid:order[0]});
  DY.draftRunCPU();
};
// skip slots whose owner has no open roster spot (or the class ran out); returns the owner on the clock or null
DY.draftAdvance = function(){
  var g = G(), d = g.off && g.off.draft; if (!d) return null;
  while (d.n < d.slots.length){
    var sl = d.slots[d.n], t = g.teams[sl.owner], empty = !DY.draftClass().length;
    if (empty || DY.freeSpots(t) <= 0){ d.picks.push({slot:d.n + 1, orig:sl.orig, tid:sl.owner, pid:null, skip:empty ? "class" : "full"}); d.n++; continue; }
    return sl.owner;
  }
  return null;
};
DY.draftOnClock = function(){ var g = G(), d = g.off && g.off.draft; if (!d || g.off.stage !== "draft" || d.n >= d.slots.length) return null; return d.slots[d.n].owner; };
function draftTake(tid, p){
  var g = G(), d = g.off.draft, sl = d.slots[d.n], no = d.picks.filter(function(x){ return x.pid != null; }).length + 1;
  p.draftRights = {tid:tid, pick:no, prem:0, tries:0, agreed:null};
  d.picks.push({slot:d.n + 1, n:no, orig:sl.orig, tid:tid, pid:p.id}); d.n++;
  DY.addLog(p, "Drafted #" + no + " overall by " + g.teams[tid].name + ".");
  DY.tx(g.teams[tid].abbr + " drafted " + p.n + " (#" + no + (sl.orig !== tid ? ", pick from " + g.teams[sl.orig].abbr : "") + ")", [tid]);
}
DY.draftRunCPU = function(){
  var g = G(), d = g.off && g.off.draft; if (!d || g.off.stage !== "draft") return;
  var guard = 0;
  while (guard++ < 40){
    var tid = DY.draftAdvance(); if (tid == null){ DY.endDraft(); return; }
    var t = g.teams[tid]; if (t.user && !g.settings.auto) return;
    var board = DY.draftBoard(tid), x = board[0]; if (board.length > 1 && chance(0.12)) x = board[1];
    draftTake(tid, x.p);
  }
};
DY.userDraft = function(pid){
  var g = G(), p = g.P[pid];
  if (DY.draftAdvance() !== g.user) return "You're not on the clock.";
  if (!p || DY.draftClass().indexOf(p) < 0) return "He's not available.";
  draftTake(g.user, p); DY.draftRunCPU(); return null;
};
DY.userDraftAuto = function(){ var b = DY.draftBoard(G().user); if (!b.length) return DY.userPass(); return DY.userDraft(b[0].p.id); };
DY.userPass = function(){ var g = G(), d = g.off.draft; if (DY.draftAdvance() !== g.user) return "You're not on the clock."; d.picks.push({slot:d.n + 1, orig:d.slots[d.n].orig, tid:g.user, pid:null, skip:"pass"}); d.n++; DY.draftRunCPU(); return null; };
DY.endDraft = function(){
  var g = G(), d = g.off.draft; if (g.off.stage !== "draft") return;
  g.off.stage = "signing";
  DY.draftClass().forEach(function(p){ p.undrafted = 1; DY.addLog(p, "Went undrafted. He's a free agent."); });
  DY.cpuSignRights();
  var made = d.picks.filter(function(x){ return x.pid != null; });
  DY.news("draft", "Rookie draft: " + made.length + " picks", made.slice(0, 6).map(function(x){ return "#" + x.n + " " + g.teams[x.tid].abbr + " — " + nm(x.pid); }).join(", ") + (made.length > 6 ? ", and more." : ".") + " " + d.picks.filter(function(x){ return x.skip === "full"; }).length + " teams sat out with full rosters. Undrafted rookies hit free agency.", {tid:made[0] ? made[0].tid : null, pid:made[0] ? made[0].pid : null});
};

/* =====================================================================================
   ROOKIE SIGNING — a real negotiation, answered on the spot.
   An accepted offer is a deal in principle until signings close. Go back on it with a worse offer and he's insulted.
   ===================================================================================== */
DY.userRights = function(){ var g = G(); return DY.active().filter(function(p){ return p.draftRights && p.draftRights.tid === g.user; }); };
DY.ROOKIE_TYPE = "2+T";   // draft-pick deals: 2 guaranteed seasons + a team option. Only the salary is negotiated.
function agreedTotal(tid, except){ return sum(DY.active().filter(function(p){ return p.draftRights && p.draftRights.tid === tid && p.draftRights.agreed && p.id !== except; }).map(function(p){ return p.draftRights.agreed.sal; })); }
DY.rookieOffer = function(pid, sal, type, cpu){
  type = DY.ROOKIE_TYPE;
  var g = G(), p = g.P[pid], r = p && p.draftRights; if (!r) return {err:"No rights to negotiate."};
  if (g.off.stage !== "signing") return {err:"Rookie signings open after the draft."};
  var t = g.teams[r.tid]; sal = Math.round(sal / 5) * 5;
  if (sal < DY.MIN_SAL || sal > DY.MAX_SAL) return {err:"Salary must be between " + DY.money(DY.MIN_SAL) + " and " + DY.money(DY.MAX_SAL) + "."};
  if (sal > DY.space(t) - agreedTotal(t.id, pid) && sal > DY.MIN_SAL) return {err:"Not enough budget space (" + DY.money(DY.space(t) - agreedTotal(t.id, pid)) + " free after your other rookie deals)."};
  var insulted = false;
  if (r.agreed){
    if (sal >= r.agreed.sal){ r.agreed = {sal:sal, type:type}; return {accepted:true, ev:{tone:"Loves the offer", why:[]}}; }
    insulted = true; r.agreed = null; r.prem += 0.1; DY.remember(p, t.id, -5);
    DY.addLog(p, t.name + " tried to back out of an agreed deal.");
  }
  var ev = DY.evalOffer(p, {tid:t.id, sal:sal, type:type}, {week:1, quiet:true, rookie:true});
  var s = ev.score - (insulted ? 0.25 : 0), accepted = s >= 0.05;
  if (accepted){ r.agreed = {sal:sal, type:type}; return {accepted:true, ev:ev, insulted:insulted}; }
  if (cpu) return {accepted:false, ev:ev};       // CPU front offices probe quietly
  r.tries++;
  if (sal < ev.ask * 0.8) r.prem += 0.03;
  if (r.tries >= 6){ DY.declineRights(pid, "walked"); return {accepted:false, walked:true, ev:ev}; }
  return {accepted:false, ev:ev, insulted:insulted, left:6 - r.tries};
};
DY.signRookie = function(pid){
  var g = G(), p = g.P[pid], r = p.draftRights, t = g.teams[r.tid];
  p.draftRights = null; p.drafted = {s:g.season + 1, pick:r.pick, tid:t.id};
  DY.signPlayer(p, t.id, r.agreed.sal, DY.ROOKIE_TYPE, "Drafted #" + r.pick + " and signed a rookie deal with"); p.con.rookie = true;
  p.signedWk = g.season * 100 + 90;
  if (p.mentor != null && DY.mentorTeam(p) === t.id){ DY.remember(p, t.id, 10); t.fan.eng = clamp(t.fan.eng + 2, 4, 99); DY.news("draft", t.city + " land " + nm(p.mentor) + "'s protégé", p.n + ", who learned the game under " + t.abbr + " legend " + nm(p.mentor) + ", signs with the franchise his mentor built.", {pid:p.id, tid:t.id}); }
};
DY.declineRights = function(pid, how){
  var g = G(), p = g.P[pid], r = p && p.draftRights; if (!r) return;
  p.draftRights = null; p.draftDeclined = r.tid; DY.remember(p, r.tid, how === "walked" ? -8 : -4);
  DY.addLog(p, how === "walked" ? "Walked away from talks with " + g.teams[r.tid].name + ". He's a free agent." : "Didn't sign with " + g.teams[r.tid].name + ". He's a free agent.");
  DY.tx(g.teams[r.tid].abbr + (how === "walked" ? " couldn't sign draft pick " : " didn't sign draft pick ") + p.n, [r.tid]);
  if (how === "walked" && g.teams[r.tid].user) DY.news("draft", p.n + " walks away", "Talks are OFF. " + p.n + " is done negotiating with " + g.teams[r.tid].name + " and heads to free agency.", {pid:pid, tid:r.tid});
};
// a rebuilding team that lands a franchise-changer will move veteran salary to afford him
DY.cpuDumpSalary = function(t, need){
  var g = G(), guard = 0;
  while (DY.space(t) < need && guard++ < 3){
    var vets = t.roster.map(function(i){ return g.P[i]; }).filter(function(q){ return q.con && q.con.sal >= 120 && q.age >= 25; }).sort(function(a, b){ return b.con.sal - a.con.sal; });
    var done = false;
    for (var i = 0; i < vets.length && !done; i++){
      var q = vets[i], takers = shuffle(g.teams.filter(function(b){ return !b.user && b.id !== t.id && DY.space(b) >= q.con.sal; }));
      for (var j = 0; j < takers.length && !done; j++){ var B = takers[j]; if (DY.tradeLegal(t, B, [q.id], [], 0) || !DY.evalTrade(t, B, [q.id], [], 0).ok) continue; DY.doTrade(t, B, [q.id], [], 0, true);
        DY.news("trade", t.name + " clear cap space", t.name + " send " + q.n + " to " + B.name + " for nothing but budget room. They're making space for their draft pick. That's commitment.", {tid:t.id, pid:q.id}); done = true; }
    }
    if (!done) break;
  }
};
// CPU teams negotiate their picks: a few offers, more aggressive for a prospect they think is special
DY.cpuSignRights = function(){
  var g = G();
  DY.active().filter(function(p){ return p.draftRights && (!g.teams[p.draftRights.tid].user || g.settings.auto); }).sort(function(a, b){ return a.draftRights.pick - b.draftRights.pick; }).forEach(function(p){
    var r = p.draftRights, t = g.teams[r.tid], sv = DY.scoutView(p, t.id), prio = sv.flag === "Generational talent" || r.pick <= 3;
    var mults = prio ? [0.96, 1.05, 1.15, 1.28] : [0.92, 1.0, 1.08], types = [DY.ROOKIE_TYPE];
    if (prio && (sv.flag === "Generational talent" || t.tag === "Rebuilding")){ var need0 = DY.askFor(p, t.id) * 1.05 + agreedTotal(t.id, p.id) + DY.MIN_SAL * Math.max(0, DY.freeSpots(t)); if (DY.space(t) < need0) DY.cpuDumpSalary(t, need0); }
    for (var i = 0; i < mults.length; i++){
      var room = DY.space(t) - agreedTotal(t.id, p.id) - (prio ? 0 : DY.MIN_SAL * Math.max(0, DY.freeSpots(t)));   // a franchise-changer comes first; fill the rest at the minimum
      var ask = DY.askFor(p, t.id), sal = Math.round(Math.min(DY.MAX_SAL, ask * mults[i]) / 5) * 5;
      if (sal > room){ if (prio && room >= ask * 0.75) sal = Math.round(room / 5) * 5; else continue; }
      if (sal < DY.MIN_SAL) sal = DY.MIN_SAL;
      var got = null;
      for (var j = 0; j < types.length && !got; j++){ var res = DY.rookieOffer(p.id, sal, types[j], true); if (res.walked) return; if (res.accepted) got = res; }
      if (got){ DY.signRookie(p.id); return; }
    }
    if (p.draftRights) DY.declineRights(p.id);
  });
};
DY.finishSignings = function(){
  var g = G(); if (!g.off || g.off.stage !== "signing") return;
  if (g.settings.auto) DY.cpuSignRights();
  DY.userRights().forEach(function(p){ if (p.draftRights.agreed) DY.signRookie(p.id); else DY.declineRights(p.id); });
  g.off.stage = "signed";
};
// walk the offseason forward to free agency from wherever the draft is (used by "open free agency" and the sims)
DY.settleDraft = function(){
  var g = G(); if (!g.off) return;
  if (g.off.stage === "options") DY.startRookieDraft();
  var guard = 0;
  while (g.off.stage === "draft" && guard++ < 40){ var oc = DY.draftAdvance(); if (oc == null){ DY.endDraft(); break; } if (oc === g.user && !g.settings.auto) DY.userDraftAuto(); else DY.draftRunCPU(); }
  if (g.off.stage === "signing") DY.finishSignings();
};
// offseason: this season's scouted prospects become the rookie class (old saves: create one now)
DY.promoteClass = function(){
  var g = G(), cls = DY.prospects().filter(function(p){ return p.rookie.cls === g.season + 1; });
  if (!cls.length){ DY.rookieClass(); return; }
  cls.forEach(function(p){ p.status = "fa"; });
  g.off.rookies = cls.map(function(p){ return p.id; });
  DY.prospects().forEach(function(p){ p.status = "fa"; });   // stragglers from an older class
  DY.weeklyScouting();                                      // one more week of scouting before the draft
};

/* =====================================================================================
   PLAYERS EVOLVE — most traits stay who he is; a few change over a career. Rare for stars who are winning.
   ===================================================================================== */
DY.restyle = function(p){ p.style = p.entry >= 72 ? "Aggressive" : p.entry >= 62 ? "Fast-paced" : p.entry <= 36 ? "Slow / anchor" : p.at.obj >= 80 && p.role === "SMG" ? "Objective player" : "Balanced"; };
DY.evolve = function(p){
  var g = G(), fin = p.team != null && g.po && g.po.fin ? g.po.fin[p.team] : 13, k = p.ovr >= 88 && fin <= 4 ? 0.45 : 1, notes = [];
  // leadership: veterans grow into it, more with time on a team and winning
  if (p.age >= 26 && chance((0.12 + (p.age >= 29 ? 0.08 : 0) + Math.min(0.08, (p.tenure || 0) * 0.02)) * k)){ var dl = rr(3, 9) * (p.lead < 80 ? 1 : 0.4); p.lead = clamp(p.lead + dl, 15, 97); if (dl >= 5) notes.push("Grew into a leader (+" + Math.round(dl) + " leadership)"); }
  // work ethic: mostly settled by 25
  if (p.age <= 25 && chance(0.12 * k)){ var dw = gauss() * 7; p.work = clamp(p.work + dw, 25, 97); if (dw >= 5) notes.push("Locked in on his craft (work ethic up)"); else if (dw <= -5) notes.push("Work ethic slipped"); }
  // consistency comes with experience
  if (p.yrs >= 2 && chance(0.15)) p.cons = clamp(p.cons + rr(1, 4), 15, 97);
  // clutch is earned (or lost) in the playoffs
  if (p.st && p.st.po && p.st.po.m >= 4){ var kd = p.st.po.k / Math.max(1, p.st.po.d); if (kd >= 1.2 && chance(0.5)){ p.clutch = clamp(p.clutch + rr(2, 5), 15, 97); if (kd >= 1.35) notes.push("Proved himself in big moments (clutch up)"); } else if (kd < 0.85 && chance(0.4)) p.clutch = clamp(p.clutch - rr(1, 4), 15, 97); }
  // the teammate trait follows his relationships
  var bs = DY.bondsOf ? DY.bondsOf(p) : [], fr = bs.filter(function(x){ return x.v >= 15; }).length, en = bs.filter(function(x){ return x.v <= -25; }).length;
  if (en >= 1 && chance(0.25)){ p.chem = clamp(p.chem - rr(2, 6), 15, 97); notes.push("Feuds are wearing on him (teammate rating down)"); } else if (fr >= 2 && chance(0.2)) p.chem = clamp(p.chem + rr(2, 5), 15, 97);
  // playstyle can shift (not counting camp)
  if (chance(0.08 * k)){
    var r = rnd(), at = p.at;
    if (r < 0.36){ at.obj = clamp(at.obj + rr(3, 6), 40, 99); at.gun = clamp(at.gun - rr(0.5, 2), 40, 99); p.entry = clamp(p.entry - rr(3, 8), 10, 98); notes.push("Became more objective-focused"); }
    else if (r < 0.7){ at.gun = clamp(at.gun + rr(2, 5), 40, 99); at.obj = clamp(at.obj - rr(1, 3), 40, 99); p.entry = clamp(p.entry + rr(3, 8), 10, 98); notes.push("Turned into more of a pure slayer"); }
    else { p.entry = clamp(p.entry - rr(8, 14), 10, 98); at.snd = clamp(at.snd + rr(1, 3), 40, 99); notes.push("Slowed his game down — more of an anchor now"); }
    DY.setOvr(p); if (p.ceil < p.ovr) p.ceil = p.ovr; DY.restyle(p);
  }
  // priorities drift a little; once in a while who he is off the server changes
  if (chance(0.06)){
    var pr = p.pri, was = p.persona;
    if (p.age >= 28){ if (chance(0.5)) pr.loyal += 0.06; else pr.win += 0.06; } else { if (chance(0.5)) pr.money += 0.06; else pr.pt += 0.04; }
    var s = pr.money + pr.win + pr.loyal + pr.pt; Object.keys(pr).forEach(function(x){ pr[x] = Math.round(pr[x] / s * 100) / 100; });
    p.persona = DY.personaLabel(pr); if (p.persona !== was) notes.push("Priorities changed: now " + p.persona);
  }
  notes.forEach(function(n){ DY.addLog(p, n + "."); });
  return notes;
};
})(typeof window !== "undefined" ? window : globalThis);
