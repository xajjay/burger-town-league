/* DYNASTY: the locker room and the front office.
   Player relationships (bonds) + drama, trade requests that leave scars, team memory, free-agent interest,
   scouting budgets, the rookie draft (weighted lottery, MLB-style signing), protégés of retired legends,
   retired jerseys, team needs, and the luxury tax. Pure engine code (no DOM). */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, rint = DY.rint, rr = DY.rr, pick = DY.pick, shuffle = DY.shuffle, chance = DY.chance, wpick = DY.wpick, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };
var nm = function(id){ var p = G().P[id]; return p ? p.n : "?"; };

/* =====================================================================================
   SAVES FROM BEFORE THIS UPDATE
   ===================================================================================== */
DY.migrate = function(g){
  g.bonds = g.bonds || {};
  g.teams.forEach(function(t){ if (t.scout == null) t.scout = 0; t.jerseys = t.jerseys || []; t.taxNext = t.taxNext || 0; if (t.sp == null) t.sp = 0; });
  g.scout = g.scout || {};
  g.teams.forEach(function(t){ if (!t.plan) t.plan = DY.PLANS[(t.id * 7 + 3) % DY.PLANS.length]; });
  if (!g.picks){ g.picks = {}; g.teams.forEach(function(t){ g.picks[t.id] = t.id; }); }
  if (g.off && g.off.draft && !g.off.draft.slots){ delete g.off.draft; g.off.stage = "options"; Object.keys(g.P).forEach(function(k){ g.P[k].draftRights = null; }); }
  if (g.off && g.off.stage === "draftdone") g.off.stage = "signed";
  Object.keys(g.P).forEach(function(k){ var p = g.P[k]; p.tmem = p.tmem || {}; if (p.trq === 1 || p.trq === true) p.trq = {s:g.season, w:g.week || 1, why:"win"}; });
  return g;
};

/* =====================================================================================
   FRONT-OFFICE PLANS — every CPU team chases a title its own way
   ===================================================================================== */
DY.PLANS = ["draft", "fa", "trade", "core", "balanced"];
DY.PLAN_NAME = {draft:"Building through the draft", fa:"Free-agency shoppers", trade:"Wheeling and dealing", core:"Keeping the core together", balanced:"Balanced approach"};
DY.PLAN_TEXT = {draft:"They scout hard, value picks, sell veterans and won't let home-grown talent walk.", fa:"They keep budget room and bid big every offseason on short deals.", trade:"Always on the phone. Picks, players, cash — everything's available for the right upgrade.", core:"Long deals and early extensions for their best players. They match offer sheets.", balanced:"A bit of everything."};
DY.randPlan = function(){ return wpick([["draft", 2], ["fa", 2], ["trade", 2], ["core", 2], ["balanced", 3]], function(x){ return x[1]; })[0]; };

/* =====================================================================================
   BONDS — how two players feel about each other (-50 beef … +50 best friends)
   ===================================================================================== */
function bk(a, b){ return a < b ? a + "_" + b : b + "_" + a; }
DY.bond = function(a, b){ var g = G(); return (g.bonds && g.bonds[bk(a, b)]) || 0; };
DY.addBond = function(a, b, d){
  var g = G(); if (a === b) return 0; g.bonds = g.bonds || {};
  var k = bk(a, b), v = clamp((g.bonds[k] || 0) + d, -50, 50);
  if (Math.abs(v) < 0.5) delete g.bonds[k]; else g.bonds[k] = Math.round(v * 10) / 10;
  return v;
};
DY.bondLabel = function(v){ return v >= 30 ? "Best friends" : v >= 15 ? "Friends" : v <= -25 ? "Beef" : v <= -12 ? "Tension" : null; };
DY.bondsOf = function(p){
  var g = G(), out = [], id = String(p.id);
  Object.keys(g.bonds || {}).forEach(function(k){ var ab = k.split("_"); if (ab[0] !== id && ab[1] !== id) return; var q = g.P[ab[0] === id ? ab[1] : ab[0]]; if (q) out.push({q:q, v:g.bonds[k]}); });
  return out.sort(function(x, y){ return Math.abs(y.v) - Math.abs(x.v); });
};
// some pairs just click and some never will: a fixed personality match for every pair of players
DY.compat = function(a, b){ var x = Math.min(a, b), y = Math.max(a, b); return hg(x * 92.71 + y * 13.37 + 5); };
// first impressions when two players become teammates
DY.meetTeam = function(p, tid){ var t = G().teams[tid]; if (!t) return; t.roster.forEach(function(id){ if (id === p.id || DY.bond(p.id, id)) return; DY.addBond(p.id, id, DY.compat(p.id, id) * 5); }); };
// how a player feels about a whole roster (used for chemistry, free agency, asking price)
DY.bondWith = function(p, tid){
  var g = G(), t = g.teams[tid], v = 0, fr = [], en = [];
  if (t) t.roster.forEach(function(id){ if (id === p.id) return; var b = DY.bond(p.id, id); if (!b) return; v += b; if (b >= 15) fr.push(id); if (b <= -12) en.push(id); });
  return {v:v, f:clamp(v / 40, -1, 0.8), fr:fr, en:en};
};
// lineup chemistry from relationships: mean bond across the 6 lineup pairs
DY.bondChem = function(ids){
  var s = 0, n = 0;
  for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++){ s += DY.bond(ids[i], ids[j]); n++; }
  return n ? clamp(s / n / 16, -1.2, 1.2) : 0;
};
// every series a lineup plays together moves their bonds a little: winning, personalities and plain luck
DY.bondSeries = function(t, won){
  var g = G(), ids = t.lineup.slice();
  for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++){
    var a = g.P[ids[i]], b = g.P[ids[j]]; if (!a || !b) continue;
    var d = ((a.chem + b.chem) / 2 - 62) / 40 + (won ? 0.3 : -0.2) + DY.compat(a.id, b.id) * 1.3;
    if (a.pri.money >= 0.38 && b.pri.money >= 0.38) d -= 0.25;               // two guys who want the bag
    if ((a.flags || []).indexOf("conflict") >= 0 || (b.flags || []).indexOf("conflict") >= 0) d -= 0.4;
    if (Math.abs(a.age - b.age) <= 2) d += 0.1;
    DY.addBond(a.id, b.id, d + gauss() * 1.4);
  }
};

/* =====================================================================================
   TEAM MEMORY — how a player remembers each franchise (-40 bad blood … +40 home)
   ===================================================================================== */
DY.memWith = function(p, tid){ return (p.tmem && p.tmem[tid]) || 0; };
DY.remember = function(p, tid, d){ p.tmem = p.tmem || {}; p.tmem[tid] = clamp(Math.round(((p.tmem[tid] || 0) + d) * 10) / 10, -40, 40); };
DY.leaveTeam = function(p, tid, how){
  var g = G(), t = g.teams[tid]; if (!t) return;
  var titles = p.acc.filter(function(a){ return a.a === "CHAMP" && a.t === t.abbr; }).length;
  var base = (p.rel - 55) * 0.3 + titles * 5 + Math.min(4, p.tenure || 0) * 1.2;
  if (how === "release") base -= 6;
  if (how === "trade") base += p.trq ? 3 : -3;
  if (p.trq) base -= 6;
  p.tmem = p.tmem || {}; p.tmem[tid] = clamp(Math.round(((p.tmem[tid] || 0) * 0.5 + base) * 10) / 10, -40, 40);
};

/* =====================================================================================
   WEEKLY MOOD + TRADE REQUESTS
   ===================================================================================== */
var WHY_TXT = {pt:"wants a starting spot", win:"is tired of losing", money:"wants to get paid what he's worth", beef:"can't co-exist with a teammate"};
DY.trqText = function(p){ if (!p.trq) return ""; var w = p.trq.why || "win"; if (w === "beef" && p.trq.with != null) return "can't co-exist with " + nm(p.trq.with); return WHY_TXT[w] || "is unhappy"; };
DY.moodWeek = function(){
  var g = G();
  DY.active().forEach(function(p){
    if (p.team == null) return;
    var t = g.teams[p.team], mv = DY.marketValue(p), why = [], gp = t.w + t.l, worst = null;
    if (p.con && p.con.sal < mv * 0.75){ p.rel -= 0.6 * p.pri.money * 2; if (p.con.sal < mv * 0.62 && p.pri.money >= 0.28) why.push("money"); }
    if (p.con && p.con.sal > mv * 1.1) p.rel += 0.4;
    p.rel += (60 - p.rel) * 0.03 * p.pri.loyal;
    if (t.lineup.indexOf(p.id) < 0 && p.pri.pt >= 0.16 && p.yrs >= 1){ p.rel -= 1.1 * p.pri.pt * 3; why.push("pt"); }
    if (gp >= 2 && t.w / gp < 0.4 && p.pri.win >= 0.28){ p.rel -= p.pri.win * 2.2; why.push("win"); }
    t.roster.forEach(function(id){ if (id === p.id) return; var b = DY.bond(p.id, id); if (b <= -25 && (!worst || b < worst[1])) worst = [id, b]; });
    if (worst){ p.rel -= 1.2; why.unshift("beef"); }
    var bw = DY.bondWith(p, t.id); p.rel += clamp(bw.v / 60, -1.2, 1);
    p.rel = clamp(p.rel, 0, 100);
    if (!p.trq && p.rel < 38 && why.length && !(p.rookie && p.yrs <= 0) && chance(0.3)){
      p.trq = {s:g.season, w:g.week, why:why[0], with:worst ? worst[0] : null};
      DY.addLog(p, "Requested a trade from " + t.name + " (" + DY.trqText(p) + ").");
      DY.news("drama", p.n + " requests a trade", "Sources tell me " + p.n + " wants OUT of " + t.city + ". He " + DY.trqText(p) + ", the record is " + t.w + "-" + t.l + ", and the relationship is broken. " + (t.user ? "Your move, front office. Trade him or talk him down — ignore it and he won't forget." : "Somebody's getting a phone call."), {pid:p.id, tid:t.id});
      t.roster.forEach(function(id){ if (id !== p.id && DY.bond(p.id, id) >= 15){ var q = g.P[id]; q.rel = clamp(q.rel - 2, 0, 100); } });
    }
  });
};
// the user can sit down with a player who wants out once a season
DY.talkItOut = function(pid){
  var g = G(), p = g.P[pid], t = DY.userT();
  if (!p || !p.trq || p.team !== t.id) return {err:"He hasn't asked for a trade."};
  if (g.phase === "playoffs") return {err:"Not during the playoffs."};
  if (p.trq.talk === g.season) return {err:"You already met with him this season."};
  p.trq.talk = g.season;
  var gp = t.w + t.l, wp = gp ? t.w / gp : 0.5, lead = Math.max.apply(null, t.roster.filter(function(i){ return i !== pid; }).map(function(i){ return g.P[i].lead; }).concat([40]));
  var w = p.trq.why, fixed = (w === "pt" && t.lineup.indexOf(pid) >= 0) || (w === "money" && p.con && p.con.sal >= DY.marketValue(p) * 0.9) || (w === "beef" && (p.trq.with == null || t.roster.indexOf(p.trq.with) < 0)) || (w === "win" && wp >= 0.6);
  var ok = clamp(0.15 + p.pri.loyal * 0.8 + (wp - 0.5) * 0.4 + (lead - 60) / 200 + (fixed ? 0.35 : 0) - (p.trq.s < g.season ? 0.1 : 0), 0.05, 0.88);
  if (chance(ok)){ p.trq = 0; p.rel = clamp(p.rel + 12, 0, 100); DY.addLog(p, "Sat down with " + t.name + " and pulled his trade request."); DY.news("drama", p.n + " pulls his trade request", "Cooler heads prevail in " + t.city + ". " + p.n + " met with the front office and he's all in again. For now.", {pid:pid, tid:t.id}); return {ok:true, fixed:fixed}; }
  p.rel = clamp(p.rel - 4, 0, 100); DY.remember(p, t.id, -3); DY.addLog(p, "A meeting with " + t.name + " about his trade request went nowhere.");
  return {ok:false, fixed:fixed};
};
// offseason: a request nobody answered becomes a grudge against the franchise
DY.trqOffseason = function(){
  var g = G();
  DY.active().forEach(function(p){
    if (!p.trq || p.team == null) return;
    var t = g.teams[p.team];
    p.rel = clamp(p.rel - 12, 0, 100); DY.remember(p, t.id, -15);
    t.roster.forEach(function(id){ if (id !== p.id && DY.bond(p.id, id) >= 15){ var q = g.P[id]; q.rel = clamp(q.rel - 3, 0, 100); } });
    DY.addLog(p, "His trade request went unanswered all season. He won't forget it.");
    if (t.user) DY.news("drama", p.n + " is still waiting", p.n + " asked out of " + t.city + " and nothing happened. That's going to cost you: he's colder toward the franchise now, and he'll remember it at the negotiating table.", {pid:p.id, tid:t.id});
  });
};

/* =====================================================================================
   LOCKER ROOM EVENTS (weekly)
   ===================================================================================== */
DY.lockerRoom = function(){
  var g = G(), cpuNews = 0;
  var say = function(t, title, body, ref){ if (t.user){ DY.news("drama", title, body, ref); return; } if (cpuNews < 2 && chance(0.5)){ cpuNews++; DY.news("drama", title, body, ref); } };
  shuffle(g.teams).forEach(function(t){
    if (t.roster.length < 4) return;
    var ps = t.roster.map(function(i){ return g.P[i]; }), pairs = [];
    for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) pairs.push([ps[i], ps[j], DY.bond(ps[i].id, ps[j].id)]);
    var low = pairs.slice().sort(function(a, b){ return a[2] - b[2]; })[0], high = pairs.slice().sort(function(a, b){ return b[2] - a[2]; })[0];
    // 1) a beef boils over
    if (low && low[2] <= -25 && chance(0.22)){
      var a = low[0], b = low[1]; a.rel = clamp(a.rel - 4, 0, 100); b.rel = clamp(b.rel - 4, 0, 100); DY.addBond(a.id, b.id, -4);
      DY.addLog(a, "Locker room blow-up with " + b.n + "."); DY.addLog(b, "Locker room blow-up with " + a.n + ".");
      say(t, "Trouble in " + t.city, "I'm hearing " + a.n + " and " + b.n + " got into it after practice. Raised voices. Headsets thrown. " + pick(["This is not a healthy locker room.", "You cannot win like this. You CANNOT.", "Somebody has to go, and everybody knows it."]), {tid:t.id, pid:a.id});
      return;
    }
    // 2) captain's speech after a losing streak
    if ((t.streak || 0) <= -2 && chance(0.35)){
      var cap = ps.slice().sort(function(x, y){ return y.lead - x.lead; })[0];
      if (cap.lead >= 80){ ps.forEach(function(q){ if (q !== cap){ DY.addBond(cap.id, q.id, 4); q.rel = clamp(q.rel + 3, 0, 100); } }); DY.addLog(cap, "Called a players-only meeting during a losing streak.");
        say(t, cap.n + " calls a team meeting", t.name + " have dropped " + (-t.streak) + " straight, and " + cap.n + " has had enough. Players-only meeting, doors closed. " + pick(["THAT is leadership.", "Sometimes you need a voice in that room.", "Watch them respond. Watch."]), {tid:t.id, pid:cap.id}); return; }
    }
    // 3) a duo forms
    if (high && high[2] >= 30 && t.w > t.l && chance(0.12) && t.lineup.indexOf(high[0].id) >= 0 && t.lineup.indexOf(high[1].id) >= 0){
      DY.addBond(high[0].id, high[1].id, 2);
      say(t, high[0].n + " & " + high[1].n + ": the best duo in the league?", "On and off the server, " + high[0].n + " and " + high[1].n + " are locked in. They're finishing each other's callouts. " + pick(["Chemistry you can't teach.", "Pay BOTH of these men.", "Every team wants a pair like this."]), {tid:t.id, pid:high[0].id}); return;
    }
    // 4) new teammates who don't click
    if (g.week <= 2 && chance(0.2)){
      var clash = pairs.filter(function(x){ return (x[0].tenure || 0) === 0 && (x[1].tenure || 0) === 0 && x[0].chem < 48 && x[1].chem < 48; })[0];
      if (clash){ DY.addBond(clash[0].id, clash[1].id, -8); say(t, "Chemistry questions in " + t.city, "Two new faces, two big personalities: " + clash[0].n + " and " + clash[1].n + " are not on the same page. " + pick(["It's early. It's also a problem.", "Somebody has to bend.", "I've seen this movie. It doesn't end well."]), {tid:t.id, pid:clash[0].id}); return; }
    }
    // 5) a veteran takes a young player under his wing
    if (chance(0.15)){
      var vet = ps.filter(function(q){ return q.age >= 28 && q.lead >= 70; })[0], kid = ps.filter(function(q){ return q.yrs <= 1 && q.age <= 22 && !q.mentored; })[0];
      if (vet && kid){ kid.mentored = 1; DY.addBond(vet.id, kid.id, 8); kid.work = clamp(kid.work + 3, 15, 97); DY.addLog(kid, vet.n + " took him under his wing."); say(t, vet.n + " takes " + kid.n + " under his wing", "Love to see it. " + vet.n + " has been staying late to run VOD with " + kid.n + ". That's how you build a culture.", {tid:t.id, pid:kid.id}); }
    }
  });
};
// offseason: bonds between players who no longer share a locker room fade a little; retired players' small bonds are dropped
DY.bondsOffseason = function(){
  var g = G(); if (!g.bonds) return;
  Object.keys(g.bonds).forEach(function(k){ var ab = k.split("_"), a = g.P[ab[0]], b = g.P[ab[1]];
    if (!a || !b){ delete g.bonds[k]; return; }
    var gone = a.status === "retired" || b.status === "retired", mates = a.team != null && a.team === b.team;
    var v = g.bonds[k] * (mates ? 1 : gone ? 0.6 : 0.88);
    if (Math.abs(v) < (gone ? 6 : 1)) delete g.bonds[k]; else g.bonds[k] = Math.round(v * 10) / 10;
  });
};

/* =====================================================================================
   FREE AGENT INTEREST: how he feels about your team before money comes up
   ===================================================================================== */
DY.interest = function(p, tid){
  var g = G(), t = g.teams[tid], ask = DY.askFor(p, tid), best = null;
  ["1", "2G", "1+1T", "1+1P"].forEach(function(ty){ var ev = DY.evalOffer(p, {tid:tid, sal:ask, type:ty}, {week:(g.off && g.off.week) || 3, quiet:true}); if (!best || ev.score > best.score) best = ev; });
  var s = best.score, lvl = s > 0.85 ? 5 : s > 0.6 ? 4 : s > 0.38 ? 3 : s > 0.18 ? 2 : 1;
  var bw = DY.bondWith(p, tid), mem = DY.memWith(p, tid), r = [];
  if (bw.fr.length) r.push(["+", "Wants to play with " + bw.fr.map(nm).slice(0, 2).join(" & ")]);
  if (bw.en.length) r.push(["-", "Doesn't want to play with " + bw.en.map(nm).slice(0, 2).join(" & ")]);
  if (mem >= 10) r.push(["+", "Good history with " + t.abbr]); if (mem <= -10) r.push(["-", "Bad blood with " + t.abbr]);
  if (p.pri.win >= 0.28) r.push([best.win > 0.15 ? "+" : best.win < -0.2 ? "-" : "~", best.win > 0.15 ? "Likes your chances to win" : best.win < -0.2 ? "Doubts your team can win" : "Unsure about your chances"]);
  if (p.pri.pt >= 0.18) r.push([best.starts ? "+" : "-", best.starts ? "Sees a starting spot" : "Worried about playing time"]);
  if (p.pri.money >= 0.36) r.push(["~", "Money will matter most"]);
  if (p.mentor != null && DY.mentorTeam(p) === tid) r.push(["+", "His mentor " + nm(p.mentor) + " is a legend here"]);
  return {lvl:lvl, label:["", "Not interested", "Lukewarm", "Open", "Interested", "Very interested"][lvl], why:r.slice(0, 3), score:s};
};

/* deterministic noise helpers (scouting reads, pair compatibility) */
function hn(a){ var x = Math.sin(a * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function hg(a){ var u = Math.max(1e-6, hn(a)), v = hn(a + 0.517); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
DY.hn = hn; DY.hg = hg;

/* =====================================================================================
   PROTÉGÉS — some rookies learned the game under a retired legend (or a veteran star)
   ===================================================================================== */
DY.mentorTeam = function(p){ var m = G().P[p.mentor]; return m && m.legacyTeam != null ? m.legacyTeam : null; };
function bestTeamFor(m){ var g = G(), best = null, bv = 0; (m.prevTeams || []).forEach(function(tid){ var L = DY.teamLegacy(m, g.teams[tid]).score; if (L > bv){ bv = L; best = tid; } }); return best; }
DY.assignMentors = function(rookies){
  var g = G(), s = g.season;
  var cands = DY.allP().filter(function(m){ return (m.status === "retired" ? s - m.retiredS <= 6 : m.age >= 30) && m.legacy >= 40; });
  if (!cands.length) return;
  var used = {};
  rookies.forEach(function(p){
    if (!chance(0.3)) return;
    var pool = cands.filter(function(m){ return m.role === p.role && !used[m.id]; }); if (!pool.length) return;
    var m = wpick(pool, function(x){ return x.legacy * (x.real ? 1.5 : 1) * (x.status === "retired" ? 1.3 : 1); }); used[m.id] = 1;
    if (m.legacyTeam == null) m.legacyTeam = bestTeamFor(m);
    p.mentor = m.id;
    p.entry = clamp((p.entry + m.entry) / 2 + gauss() * 4, 10, 95); p.work = clamp(p.work + 6, 30, 97);
    if (m.clutch >= 80) p.clutch = clamp(p.clutch + 6, 25, 95);
    var fav = Object.keys(m.maps || {}).filter(function(k){ return m.maps[k] > 0.8; })[0]; if (fav) p.maps[fav] = Math.max(p.maps[fav] || 0, Math.round(m.maps[fav] * 7) / 10);
    p.style = m.style || p.style;
    DY.addLog(p, "Learned the game under " + m.n + (m.status === "retired" ? ", the retired " + (m.real ? "BTL original" : "legend") : "") + ".");
  });
};

/* =====================================================================================
   RETIRED JERSEYS — only true franchise legends
   ===================================================================================== */
DY.JERSEY_RULE = "4+ seasons with the franchise, a franchise legacy of 110+, and either 2 championships or an MVP won there.";
DY.retireJerseys = function(ids){
  var g = G();
  ids.forEach(function(id){
    var p = g.P[id];
    (p.prevTeams || []).forEach(function(tid){
      var t = g.teams[tid], L = DY.teamLegacy(p, t), c = function(k){ return L.acc.filter(function(a){ return a.a === k; }).length; }, big = c("CHAMP") >= 2 || c("MVP") >= 1;
      if (L.seasons >= 4 && L.score >= 110 && big && !t.jerseys.some(function(j){ return j.pid === id; })){
        t.jerseys.push({pid:id, s:g.season}); p.jerseys = (p.jerseys || []).concat([tid]);
        DY.addLog(p, t.name + " retired his jersey.");
        DY.news("hof", t.name + " retire " + p.n + "'s jersey", "Nobody in " + t.city + " will ever wear it again. " + p.n + ": " + L.seasons + " seasons, " + L.acc.filter(function(a){ return a.a === "CHAMP"; }).length + " title" + (L.acc.filter(function(a){ return a.a === "CHAMP"; }).length === 1 ? "" : "s") + " in " + t.abbr + " colors. " + pick(["Up to the rafters.", "A franchise icon.", "Tears in my eyes. Real ones."]), {pid:id, tid:tid});
      }
    });
  });
};

/* =====================================================================================
   TEAM NEEDS — skill averages vs the league (draft board, free agency)
   ===================================================================================== */
DY.teamAttr = function(ids){ var P = G().P, o = {}; DY.ATTR.forEach(function(k){ o[k] = ids.length ? mean(ids.map(function(i){ return P[i].at[k]; })) : null; }); return o; };
DY.teamNeeds = function(tid, useLineup){
  var g = G(), pick4 = function(t){ return useLineup && t.lineup.length === 4 ? t.lineup : t.roster; };
  var all = g.teams.filter(function(t){ return t.roster.length; }).map(function(t){ return {t:t, a:DY.teamAttr(pick4(t))}; });
  var me = g.teams[tid], mine = DY.teamAttr(pick4(me)), out = {a:mine, rank:{}, league:{}, weak:[], n:all.length};
  DY.ATTR.forEach(function(k){ out.league[k] = mean(all.map(function(x){ return x.a[k]; })); out.rank[k] = mine[k] == null ? null : all.filter(function(x){ return x.a[k] > mine[k]; }).length + 1; });
  if (me.roster.length) out.weak = DY.ATTR.slice().sort(function(a, b){ return (mine[a] - out.league[a]) - (mine[b] - out.league[b]); }).filter(function(k){ return mine[k] < out.league[k] + 0.5; }).slice(0, 2);
  var c = DY.roleCounts(me.roster); out.roles = c;
  return out;
};
DY.fitFor = function(p, needs){ if (DY.hiddenOvr(p) || !needs || !needs.weak.length) return []; return needs.weak.filter(function(k){ return p.at[k] >= Math.max(needs.a[k], needs.league[k]) + 2; }); };

/* =====================================================================================
   LUXURY TAX — start a season over budget and half the overage comes off next season's budget
   ===================================================================================== */
DY.applyTax = function(){
  var g = G();
  g.teams.forEach(function(t){ var over = -DY.space(t); t.taxNext = over > 0 ? Math.round(over * 0.5 / 5) * 5 : 0;
    if (t.taxNext && t.user) DY.news("move", "Luxury tax bill", t.name + " start Season " + g.season + " " + DY.money(over) + " over budget. Half of that (" + DY.money(t.taxNext) + ") comes off next season's budget.", {tid:t.id}); });
};
})(typeof window !== "undefined" ? window : globalThis);
