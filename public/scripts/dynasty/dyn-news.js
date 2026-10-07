/* DYNASTY: the league news desk — Stephen A. Sizzle on every big moment. */
(function(root){
"use strict";
var DY = root.DY, rnd = DY.rnd, gauss = DY.gauss, pick = DY.pick, chance = DY.chance, clamp = DY.clamp, mean = DY.mean, sum = DY.sum;
var G = function(){ return DY.G; };
var nm = function(id){ return G().P[id] ? G().P[id].n : "?"; }, tn = function(id){ return G().teams[id].name; };

DY.news = function(type, title, body, ref){
  var g = G(); ref = ref || {};
  g.news.unshift({id:(g.newsId = (g.newsId || 0) + 1), s:g.season, w:g.phase === "offseason" ? "Offseason" : g.phase === "playoffs" ? "Playoffs" : g.phase === "draft" ? "Draft" : g.phase === "preseason" ? "Preseason" : "Week " + g.week, type:type, title:title, body:body, pid:ref.pid, tid:ref.tid, pr:ref.pr});
  if (g.news.length > 260) g.news.length = 260;
};
var OPEN = ["Let me tell you something.", "Somebody get me a microphone.", "I'm going to say this with my chest.", "This is BLASPHEMOUS.", "Ladies and gentlemen, please.", "However...", "I'm telling you right now.", "Don't do this to me.", "Hold on. Hold on. HOLD ON.", "We need to talk about this."];

DY.weeklyNews = function(prevPR){
  var g = G(), wk = g.week, pr = g.pr;
  // power rankings
  var rows = pr.map(function(id, i){ var t = g.teams[id], was = prevPR.indexOf(id); return {id:id, rk:i + 1, mv:was < 0 ? 0 : was - i, rec:t.w + "-" + t.l}; });
  var riser = rows.slice().sort(function(a, b){ return b.mv - a.mv; })[0], faller = rows.slice().sort(function(a, b){ return a.mv - b.mv; })[0];
  DY.news("power", "Week " + wk + " Power Rankings", pick(OPEN) + " " + tn(rows[0].id) + " sit on top at " + rows[0].rec + "." + (riser && riser.mv >= 2 ? " Biggest climber: " + tn(riser.id) + " (up " + riser.mv + ")." : "") + (faller && faller.mv <= -2 ? " " + tn(faller.id) + " slide " + (-faller.mv) + " spots — somebody check on them." : ""), {pr:rows});
  // upsets + big performances from this week's two rounds
  var res = g.res.filter(function(r){ return r.r >= g.round - 2; });
  res.forEach(function(r){
    var w = r.wa > r.wb ? r.a : r.b, l = r.wa > r.wb ? r.b : r.a, rw = prevPR.indexOf(w), rl = prevPR.indexOf(l);
    if (rw >= 0 && rl >= 0 && rw - rl >= 7) DY.news("upset", "UPSET: " + tn(w) + " stun " + tn(l), pick(OPEN) + " The #" + (rw + 1) + " team in my rankings just took down #" + (rl + 1) + ", " + Math.max(r.wa, r.wb) + "-" + Math.min(r.wa, r.wb) + ". " + pick(["Nobody saw this coming. NOBODY.", "I'm not saying I called it. I'm saying I didn't NOT call it.", "That's why you play the games!"]), {tid:w});
  });
  var bigs = [].concat.apply([], g.weekLog.filter(function(x){ return x.t === "bigs"; }).map(function(x){ return x.list; })).sort(function(a, b){ return b.war - a.war; });
  var b = bigs[0];
  if (b){ var p = G().P[b.id], t = p.team != null ? g.teams[p.team] : null;
    DY.news("perf", p.n + " goes OFF", p.n + " dropped " + b.k + " kills on " + (b.k / Math.max(1, b.d)).toFixed(2) + " K/D in " + tn(b.a) + " vs " + tn(b.b) + " (" + b.wa + "-" + b.wb + "). " + pick(["That's a grown man performance.", "Somebody tell the All-Star voters.", "He was SICK. Disgusting. Beautiful.", "Put some respect on that name."]), {pid:b.id, tid:t ? t.id : null}); }
  // streaks and slumps (players)
  var hot = DY.active().filter(function(p){ return p.team != null && p.hot > 1.8 && p.ovr >= 78; }).sort(function(a, b){ return b.hot - a.hot; })[0];
  if (hot && chance(0.5)) DY.news("perf", hot.n + " is heating up", hot.n + " is on a heater for " + tn(hot.team) + ". You can't leave this man open.", {pid:hot.id, tid:hot.team});
  var cold = DY.active().filter(function(p){ return p.team != null && p.form < -2.5 && p.ovr >= 85 && p.st.reg.m >= 6; }).sort(function(a, b){ return a.form - b.form; })[0];
  if (cold && chance(0.4)) DY.news("drama", "What is wrong with " + cold.n + "?", "A " + DY.kd(cold.st.reg.k, cold.st.reg.d).toFixed(2) + " K/D? From " + cold.n + "? " + pick(["I need answers.", "This is an OFF year, and I'm being nice.", "Something is not right."]), {pid:cold.id, tid:cold.team});
  // pool races
  if (wk >= 3 && g.round < DY.ROUNDS){ var pl = pick(DY.POOLS), ps = DY.poolStandings(pl); DY.news("race", DY.POOL_NAME[pl] + " pool race", ps.map(function(t, i){ return (i + 1) + ". " + t.name + " " + t.w + "-" + t.l; }).join(" · ") + ". Top 2 go to the winners bracket, 3rd starts in elimination, 4th goes home.", {}); }
  // subs/absences
  g.weekLog.filter(function(x){ return x.t === "sub"; }).slice(0, 1).forEach(function(x){ DY.news("move", nm(x.out) + " misses a match", nm(x.out) + " had a scheduling conflict. " + nm(x.inn) + " stepped in for " + tn(x.tm) + ".", {pid:x.out, tid:x.tm}); });
};
DY.playoffNews = function(){
  var g = G(), A = g.awards, s = g.po.seeds;
  DY.news("award", "Regular season awards", "MVP: " + (A.mvp != null ? nm(A.mvp) : "—") + ". Rookie of the Year: " + (A.roy != null ? nm(A.roy) : "nobody qualified") + ". Most Improved: " + (A.mip != null ? nm(A.mip) : "—") + ". All-Star 1st team: " + A.as1.map(nm).join(", ") + ". And the Super Burger goes to... " + (A.sb != null ? nm(A.sb) : "—") + ". Condolences.", {pid:A.mvp});
  DY.news("race", "Playoff field is set", "Winners bracket: " + s.slice(0, 8).map(function(id, i){ return "(" + (i + 1) + ") " + g.teams[id].abbr; }).join(", ") + ". Elimination bracket: " + s.slice(8).map(function(id, i){ return "(" + (i + 9) + ") " + g.teams[id].abbr; }).join(", ") + ". Rosters are LOCKED. " + pick(["Win or go home.", "This is where legacies are made.", "Now we find out who's REAL."]), {});
  if (g.mpo) DY.news("acad", "Academy champions: " + g.minors[g.mpo.champ].name, "The Academy title goes to " + g.minors[g.mpo.champ].name + ". " + (A.amvp != null ? "Academy MVP " + nm(A.amvp) + " just put every front office on notice." : ""), {pid:A.amvp});
};
DY.playoffResultNews = function(id, r){
  var g = G(), w = r.wa > r.wb ? r.a : r.b, l = r.wa > r.wb ? r.b : r.a, sw = g.po.pseeds[w], sl = g.po.pseeds[l];
  var M = DY.PO[id];
  var out = /^L/.test(id) || id === "GF2" || (id === "GF" && l === DY.poRef(DY.PO.GF.b)) || (g.po.pseeds[l] >= 9 && /^L[1-4]$/.test(id));
  if (sw - sl >= 5) DY.news("upset", "Playoff upset: " + tn(w) + " over " + tn(l), "The " + sw + " seed knocks off the " + sl + " seed in the " + M.r + ". " + pick(OPEN), {tid:w});
  else if (out && sl <= 4 && !/^GF/.test(id)) DY.news("race", tn(l) + " are eliminated", "The " + sl + " seed is done, " + Math.max(r.wa, r.wb) + "-" + Math.min(r.wa, r.wb) + " to " + tn(w) + " in the " + M.r + ". " + pick(["Long offseason ahead.", "Somebody's getting fired. Maybe. Probably.", "Blow it up? I'm just asking questions."]), {tid:l});
};
DY.championNews = function(){
  var g = G(), c = g.po.champ, r = g.po.ru, f = g.po.res.GF2 || g.po.res.GF;
  DY.news("champ", tn(c) + " are Season " + g.season + " champions", pick(["CHAMPIONS! I said what I said!", "Pop the bottles.", "They did it. They ACTUALLY did it."]) + " " + tn(c) + " beat " + tn(r) + " " + Math.max(f.wa, f.wb) + "-" + Math.min(f.wa, f.wb) + (g.po.res.GF2 ? " in the bracket reset" : " in the grand final") + ". Finals MVP: " + (g.awards.fmvp != null ? nm(g.awards.fmvp) : "—") + ".", {tid:c, pid:g.awards.fmvp});
};
DY.tradeNews = function(A, B, ga, gb, cash){
  var g = G(), big = ga.concat(gb).filter(function(i){ return !DY.isPick(i); }).map(function(i){ return g.P[i]; }).sort(function(a, b){ return b.ovr - a.ovr; })[0];
  var list = function(ids){ return ids.length ? ids.map(DY.itemName).join(" + ") : "future considerations"; };
  DY.news("trade", "TRADE: " + (big ? big.n + " is on the move" : A.abbr + " and " + B.abbr + " make a deal"), A.name + " get " + list(gb) + (cash < 0 ? " and " + DY.money(-cash) + " in budget" : "") + ". " + B.name + " get " + list(ga) + (cash > 0 ? " and " + DY.money(cash) + " in budget" : "") + ". " + pick(["Winners and losers? Ask me in May.", "I LOVE this trade. For one side.", "Somebody got fleeced and I think we all know who.", "Bold. Very bold."]), {tid:A.id, pid:big ? big.id : null});
};
DY.offseasonNews = function(){
  var g = G(), o = g.off;
  if (o.retired.length) DY.news("retire", o.retired.length + " player" + (o.retired.length > 1 ? "s" : "") + " retire", "Hanging them up: " + o.retired.slice(0, 8).map(function(id){ var p = g.P[id]; return p.n + " (" + p.yrs + " seasons, legacy " + p.legacy + ")"; }).join(", ") + (o.retired.length > 8 ? " and more" : "") + ". " + (g.P[o.retired[0]].legacy > 80 ? "We will never see another " + g.P[o.retired[0]].n + ". Never." : "Thank you for your service."), {pid:o.retired[0]});
  if (o.hof.length) DY.news("hof", "Hall of Fame: Class of Season " + g.season, o.hof.map(nm).join(", ") + ". First ballot. Gold jacket. Tears in my eyes.", {pid:o.hof[0]});
  var prog = Object.keys(o.prog).map(function(id){ return {p:g.P[id], x:o.prog[id]}; }).filter(function(z){ return z.p.status !== "retired"; });
  var up = prog.slice().sort(function(a, b){ return b.x.d - a.x.d; }).slice(0, 3), dn = prog.slice().sort(function(a, b){ return a.x.d - b.x.d; }).slice(0, 3);
  DY.news("prog", "Offseason progression report", "Biggest jumps: " + up.map(function(z){ return z.p.n + " " + z.x.from + "→" + z.x.to; }).join(", ") + ". Biggest drops: " + dn.map(function(z){ return z.p.n + " " + z.x.from + "→" + z.x.to; }).join(", ") + ". " + pick(["Father Time is undefeated.", "Somebody spent the summer in the lab.", "The kids are COMING."]), {});
  var top = g.off.rookies.slice(0, 5).map(function(id){ var p = g.P[id]; return "#" + p.rookie.rank + " " + p.n + " (" + p.role + ", " + p.potG + ")"; });
  DY.news("rookie", "Season " + (g.season + 1) + " prospect rankings", "Top of the class: " + top.join(", ") + ". " + pick(["Rankings are opinions. Opinions are not guarantees.", "One of these kids is going to be a problem. One of them is going to be a bust. Good luck figuring out which.", "I've seen the tape. Some of it, anyway."]), {pid:g.off.rookies[0]});
};
DY.faWeekNews = function(wk, signed){
  var g = G(); if (!signed.length){ DY.news("fa", "Free agency week " + wk + ": quiet", "No signatures this week. Players are waiting on better offers.", {}); return; }
  var big = signed.slice().sort(function(a, b){ return b.sal - a.sal; });
  DY.news("fa", "Free agency week " + wk + ": " + signed.length + " signing" + (signed.length > 1 ? "s" : ""), big.slice(0, 6).map(function(x){ var p = g.P[x.pid]; return p.n + " → " + g.teams[x.tid].abbr + " (" + DY.money(x.sal) + ")"; }).join(", ") + (big.length > 6 ? ", and more." : ".") + (big[0].sal >= 500 ? " " + pick(["That's a BAG.", "Pay the man!", "Somebody's eating good tonight."]) : ""), {pid:big[0].pid, tid:big[0].tid});
};
DY.rookieRevealNews = function(list){
  if (!list.length) return;
  var srt = list.slice().sort(function(a, b){ return b.ovr - a.ovr; }), best = srt[0], worst = list.slice().sort(function(a, b){ return (a.ovr - a.rookie.est) - (b.ovr - b.rookie.est); })[0], gem = list.slice().sort(function(a, b){ return (b.ovr - b.rookie.est) - (a.ovr - a.rookie.est); })[0];
  DY.news("rookie", "Rookie overalls revealed", "The best of the new class is " + best.n + " at " + Math.round(best.ovr) + " OVR. " + (gem.ovr - gem.rookie.est >= 3 ? gem.n + " came in way better than the scouts thought (" + Math.round(gem.ovr) + "). " : "") + (worst.ovr - worst.rookie.est <= -3 ? "And " + worst.n + "... was scouted at " + Math.round(worst.rookie.est) + ". He's a " + Math.round(worst.ovr) + ". Yikes." : ""), {pid:best.id, tid:best.team});
};
DY.preseasonNews = function(){
  var g = G(), pr = g.pr;
  DY.news("power", "Season " + g.season + " preseason rankings", "1. " + tn(pr[0]) + ", 2. " + tn(pr[1]) + ", 3. " + tn(pr[2]) + ". At the bottom: " + tn(pr[15]) + ". " + pick(["Write it down.", "Screenshot this.", "Argue with your mother, not me."]), {pr:pr.map(function(id, i){ return {id:id, rk:i + 1, mv:0, rec:"0-0"}; })});
};
})(typeof window !== "undefined" ? window : globalThis);
