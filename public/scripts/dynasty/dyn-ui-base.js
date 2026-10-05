/* DYNASTY UI: shared helpers, player card, team page, box scores, bracket, negotiation forms. */
(function(){
"use strict";
var DY = window.DY, X = window.DYU = window.DYU || {};
var G = function(){ return DY.G; };
var esc = X.esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]; }); };
var P = X.P = function(id){ return G().P[id]; }, T = X.T = function(id){ return G().teams[id]; };
var f2 = X.f2 = function(x){ return (x || 0).toFixed(2); }, f1 = X.f1 = function(x){ return (x || 0).toFixed(1); }, f0 = X.f0 = function(x){ return Math.round(x || 0); };
var money = X.money = DY.money;
var kd = X.kd = function(k, d){ return d ? k / d : (k || 0); };
X.U = X.U || {};
var U = X.U;

/* ---------- small renderers ---------- */
X.pl = function(id, label){ var p = P(id); if (!p) return "—"; return '<a class="pl" data-a="player" data-arg="' + id + '">' + esc(label || p.n) + '</a>' + (G().hof.indexOf(id) >= 0 ? ' <span class="badge gold" title="Hall of Fame">HOF</span>' : ''); };
X.tm = function(tid, abbr){ if (tid == null) return '<span class="muted">FA</span>'; var t = T(tid); return '<a class="tm" data-a="team" data-arg="' + tid + '">' + esc(abbr ? t.abbr : t.name) + '</a>' + (t.user ? ' ★' : ''); };
X.role = function(p){ return '<span class="role ' + p.role + '" title="' + (p.flex != null ? "Flex: plays AR and SMG" : p.role) + '">' + (p.flex != null ? "FLEX" : p.role) + '</span>'; };
X.ovr = function(p, big){ if (DY.hiddenOvr(p)) return '<span class="ovr q" title="True overall is hidden until he signs and a new season starts. Scouts think about ' + Math.round(p.rookie.est) + '.">??</span>'; var o = Math.round(p.ovr); return '<span class="ovr ' + (o >= 90 ? "t1" : o >= 84 ? "t2" : o >= 78 ? "t3" : "") + '">' + o + '</span>'; };
X.pot = function(p){ return '<span class="pot ' + p.potG[0] + '" title="Scouted potential. Not a guarantee.">' + p.potG + '</span>'; };
X.tagChip = function(tag){ return '<span class="tagchip ' + tag + '" title="' + esc(DY.TAG_TEXT[tag]) + '">' + tag + '</span>'; };
X.delta = function(d, digits){ if (d == null) return ""; var v = digits ? d.toFixed(digits) : Math.round(d); return '<span class="' + (d > 0.05 ? "up" : d < -0.05 ? "dn" : "muted") + '">' + (d > 0.05 ? "+" : "") + v + '</span>'; };
X.btn = function(a, text, cls, arg, dis, title){ return '<button class="gbtn ' + (cls || "ghost") + '" data-a="' + a + '"' + (arg != null ? ' data-arg="' + esc(String(arg)) + '"' : '') + (dis ? ' disabled' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + text + '</button>'; };
X.panel = function(label, inner, cls){ return '<div class="panel ' + (cls || "") + '">' + (label ? '<div class="label" style="margin-bottom:10px">' + label + '</div>' : '') + inner + '</div>'; };
X.table = function(cols, rows, cls){ return '<div class="tscroll ' + (cls || "") + '"><table class="tb"><thead><tr>' + cols.map(function(c){ var o = typeof c === "string" ? {h:c} : c; return '<th class="' + (o.n ? "n " : "") + (o.s ? "sort " + (o.on ? "on" : "") : "") + '"' + (o.s ? ' data-a="' + o.s + '" data-arg="' + o.k + '"' : '') + (o.t ? ' title="' + esc(o.t) + '"' : '') + '>' + o.h + '</th>'; }).join("") + '</tr></thead><tbody>' + (rows.length ? rows.join("") : '<tr><td colspan="' + cols.length + '" class="muted">Nothing here yet.</td></tr>') + '</tbody></table></div>'; };
X.kv = function(k, v){ return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; };
X.bar = function(label, v, max, cls, shown){ return '<div class="bar"><span>' + label + '</span><div class="tr"><div class="fi ' + (cls || "") + '" style="width:' + Math.max(2, Math.min(100, v / (max || 100) * 100)) + '%"></div></div><span class="v">' + (shown != null ? shown : Math.round(v)) + '</span></div>'; };
X.meter = function(v, color){ return '<div class="meter" title="' + Math.round(v) + '/100"><i style="width:' + Math.max(3, v) + '%;background:' + (color || (v >= 65 ? "var(--ok)" : v >= 40 ? "var(--mustard)" : "var(--bad)")) + '"></i></div>'; };
X.sLine = function(s){ s = DY.uS(s); if (!s || !s.m) return null; return {m:s.m, k:s.k, d:s.d, kd:kd(s.k, s.d), hp:s.hm ? kd(s.hk, s.hd) : null, snd:s.sm ? kd(s.sk, s.sd) : null, ctl:s.cm ? kd(s.ck, s.cd) : null, hill:s.hm ? s.hill / s.hm : null, sobj:s.sm ? (s.pl + s.df) / s.sm : null, fb:s.sm ? s.fb / s.sm : null, ok:s.cm ? s.ok / s.cm : null, war:s.war, war10:s.war / s.m * 10, ipm:(s.k + s.d) / s.m, sw:s.sw || 0, sl:s.sl || 0, best:s.best || 0, so:DY.seasonOvr(s)}; };
X.when = function(n){ return '<span class="nw">S' + n.s + ' · ' + esc(n.w) + '</span>'; };
X.stageText = function(p){ var s = DY.stage(p); return s; };
X.statusLine = function(p){ if (p.status === "retired") return "Retired after Season " + p.retiredS; if (p.team != null) return X.tm(p.team); var m = p.minor != null && G().minors[p.minor] ? G().minors[p.minor].name : "NONE"; return '<span class="muted">Free agent · Academy: ' + esc(m) + '</span>'; };
X.formTag = function(p){
  if (!p.st || p.status === "retired") return "";
  var s = p.team != null ? p.st.reg : p.st.mi; if (!s || s.m < 6) return p.hot > 1.4 ? '<span class="badge green">Heating up</span>' : p.hot < -1.4 ? '<span class="badge red">Cold streak</span>' : "";
  var so = DY.seasonOvr(s), d = so - (G().perfFit ? G().perfFit.a + G().perfFit.b * p.ovr : p.ovr);
  if (d >= 5) return '<span class="badge green">Career year pace</span>'; if (d <= -6) return '<span class="badge red">Off year</span>';
  return p.hot > 1.4 ? '<span class="badge green">Heating up</span>' : p.hot < -1.4 ? '<span class="badge red">Cold streak</span>' : "";
};
X.toneCls = function(t){ return t === "Loves the offer" ? "t5" : t === "Very interested" ? "t4" : t === "Open to it" ? "t3" : t === "Lukewarm" ? "t2" : "t1"; };
X.toast = function(msg, ms){ var el = document.createElement("div"); el.className = "toast"; el.innerHTML = msg; var host = document.getElementById("gm-body"); host.appendChild(el); setTimeout(function(){ el.remove(); }, ms || 3200); };
X.spark = function(vals, w, h){ if (vals.length < 2) return ""; var mn = Math.min.apply(null, vals) - 1, mx = Math.max.apply(null, vals) + 1, pts = vals.map(function(v, i){ return (i / (vals.length - 1) * (w - 6) + 3).toFixed(1) + "," + (h - 3 - (v - mn) / (mx - mn) * (h - 6)).toFixed(1); }).join(" "); return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="var(--mustard)" stroke-width="2"/></svg>'; };

/* ---------- team logos (generated: crest shape + team colors + monogram) ---------- */
var SHAPES = ["M50 4 L92 17 V48 C92 73 73 89 50 97 C27 89 8 73 8 48 V17 Z", "M50 5 A45 45 0 1 0 50.01 5 Z", "M50 4 L90 27 V73 L50 96 L10 73 V27 Z", "M22 6 H78 Q94 6 94 22 V78 Q94 94 78 94 H22 Q6 94 6 78 V22 Q6 6 22 6 Z", "M50 3 L93 30 L80 92 H20 L7 30 Z"];
function lum(hex){ var c = hex.replace("#", ""), r = parseInt(c.substr(0, 2), 16) / 255, g = parseInt(c.substr(2, 2), 16) / 255, b = parseInt(c.substr(4, 2), 16) / 255; return 0.299 * r + 0.587 * g + 0.114 * b; }
X.logo = function(t, size){
  size = size || 40; if (!t) return "";
  var c1 = t.c1 || "#888888", c2 = t.c2 || "#111111", txt = lum(c1) > 0.6 ? "#111111" : "#ffffff", sh = SHAPES[(t.shape != null ? t.shape : (t.abbr.charCodeAt(0) + t.abbr.length)) % SHAPES.length];
  var mono = (t.nick && t.nick.trim() ? t.nick.trim()[0] : t.city[0]).toUpperCase(), cityI = t.city.trim()[0].toUpperCase();
  return '<span class="logo" style="width:' + size + 'px;height:' + size + 'px" title="' + esc(t.name) + '"><svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true"><defs><clipPath id="lc' + t.id + '-' + size + '"><path d="' + sh + '"/></clipPath></defs><path d="' + sh + '" fill="' + c1 + '"/><g clip-path="url(#lc' + t.id + '-' + size + ')"><path d="M-10 96 L110 70 L110 84 L-10 110 Z" fill="' + c2 + '" opacity=".9"/></g><path d="' + sh + '" fill="none" stroke="' + c2 + '" stroke-width="6"/><text x="50" y="62" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="900" font-size="46" fill="' + txt + '" stroke="' + c2 + '" stroke-width="1.5" paint-order="stroke">' + esc(mono) + '</text>' + '</svg></span>';
};

/* ---------- generated scouting report (from stats, traits and personality; never the raw notes) ---------- */
function hsh(s){ var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pk(arr, seed){ return arr[seed % arr.length]; }
X.report = function(p){
  var sd = hsh(p.n), hidden = DY.hiddenOvr(p), out = [];
  if (hidden){
    var sc = p.rookie.scout;
    out.push(pk(["Raw " + p.role + " prospect", "Unproven " + p.role + " out of the amateur scene", p.role + " prospect with a " + p.potG + " grade from the scouts"], sd) + ". Amateur numbers: " + f2(sc.kd) + " K/D, " + f2(sc.snd) + " in SnD over " + sc.maps + " scouted maps.");
    out.push(p.rookie.rank <= 3 ? "One of the headliners of his class. Every rebuilding team will make a call." : p.rookie.rank <= 10 ? "Projects as a real piece if he develops." : "A long shot, but every class has a surprise or two.");
    if (p.rookie.holdout) out.push("Word is he wants to start his career on a contender and won't jump at the first offer.");
    out.push(pk(["Wants a main-league spot more than anything.", "Playing time will matter to him in negotiations.", "Mostly wants a chance to prove himself."], sd >> 3));
    return out;
  }
  var a = p.at, o = p.ovr, modes = [["hp", "Hardpoint"], ["snd", "Search & Destroy"], ["ctl", "Control"]];
  var bestM = modes.slice().sort(function(x, y){ return a[y[0]] - a[x[0]]; }), spread = a[bestM[0][0]] - a[bestM[2][0]];
  var lead = p.tier === "Star / captain" || o >= 90 ? pk(["Franchise-level", "Star", "Top-of-the-league"], sd) : p.tier === "Strong #2" || o >= 85 ? pk(["High-end second option", "Strong number-two", "Quality starter"], sd) : o >= 78 ? pk(["Solid starter", "Reliable 3rd/4th man", "Useful role player"], sd) : pk(["Depth piece", "Fringe starter", "Bench option"], sd);
  var style = {"Aggressive":"who plays fast and takes fights", "Fast-paced":"with a fast, high-interaction game", "Balanced":"with a balanced, fundamental game", "Slow / anchor":"who anchors lanes and plays the long angles", "Objective player":"who lives on the objective"}[p.style] || "";
  out.push(lead + " " + p.role + " " + style + ".");
  if (spread >= 6) out.push(pk(["His best mode is", "He is at his best in", "Built for"], sd >> 2) + " " + bestM[0][1] + " (" + Math.round(a[bestM[0][0]]) + "), while " + bestM[2][1] + " (" + Math.round(a[bestM[2][0]]) + ") is the weak spot.");
  else out.push(pk(["Good in every mode with no real weakness.", "An all-mode player: nothing stands out, nothing lags.", "Balanced across Hardpoint, SnD and Control."], sd >> 2));
  if (a.gun - o >= 3) out.push("The gun is the calling card: he wins straight-up fights.");
  else if (o - a.gun >= 4) out.push("Not a pure slayer; he wins with positioning and team play more than raw gunskill.");
  if (a.obj >= 84) out.push(pk(["Elite objective player: hill time, plants and Control objective kills.", "Does the dirty work: rotates, plays the hill, plants the bomb."], sd >> 4));
  else if (a.obj <= 62) out.push("Not an objective player; teams will need someone else on the hill.");
  if (p.entry >= 72) out.push("Gets a lot of first bloods, and gives up his share of first deaths.");
  if (p.clutch >= 85) out.push("Shows up in big moments.");
  if (p.cons >= 86) out.push("Very consistent; you know what you get every night."); else if (p.cons <= 55) out.push("Streaky: capable of huge nights and quiet ones.");
  if (p.lead >= 85) out.push("A real leader who runs comms and gets the most out of teammates.");
  if (p.chem >= 85) out.push("Great teammate, good vibes in any locker room."); else if (p.chem <= 40) out.push("Can be hard to play with when things go wrong.");
  if (p.avail >= 0.05) out.push("Availability is a question: he misses matches more than most.");
  if (p.realLine){ var r = p.realLine; out.push("Real BTL track record: " + r.seasons + " season" + (r.seasons > 1 ? "s" : "") + ", " + f2(r.kd) + " career K/D over " + r.m + " maps" + (r.snd != null ? ", " + f2(r.snd) + " in SnD" : "") + "."); }
  var stg = DY.stage(p); out.push(stg === "Rising" ? "Still young and improving." : stg === "Twilight" ? "Late in his career; decline is coming." : stg === "Veteran" ? "A veteran near the end of his prime." : "In his prime.");
  out.push(DY.PERSONA_TEXT[p.persona] || "");
  return out.filter(Boolean);
};
function trend(p){ var r = (p.recent || []).slice(-5); if (r.length < 3) return null; var k = sum(r.map(function(x){ return x[0]; })), d = sum(r.map(function(x){ return x[1]; })), s = p.st ? (p.team != null ? p.st.reg : p.st.mi) : null; var sk = s && s.d ? s.k / s.d : k / Math.max(1, d), rk = k / Math.max(1, d); return {kd:rk, d:rk - sk, list:r}; }
X.trend = trend;
X.trendTag = function(p){ var t = trend(p); if (!t) return ""; return t.d >= 0.12 ? '<span class="badge green" title="Last 5 series K/D ' + f2(t.kd) + '">▲ Trending up</span>' : t.d <= -0.12 ? '<span class="badge red" title="Last 5 series K/D ' + f2(t.kd) + '">▼ Trending down</span>' : ""; };
var sum = function(a){ return a.reduce(function(x, y){ return x + y; }, 0); };

/* ---------- modal stack ---------- */
X.openModal = function(kind, arg, extra){ U.modal = {kind:kind, arg:arg, tab:(extra && extra.tab) || null, live:extra && extra.live, cur:0, evN:0}; X.renderModal(); };
X.closeModal = function(){ U.modal = null; if (U.liveT){ clearInterval(U.liveT); U.liveT = null; } X.renderModal(); };
X.renderModal = function(){
  var host = document.getElementById("dy-modal-host");
  if (!U.modal){ host.innerHTML = ""; document.body.style.overflow = ""; return; }
  var m = U.modal, body = m.kind === "player" ? X.playerCard(m.arg) : m.kind === "team" ? X.teamPage(m.arg) : m.kind === "box" ? X.boxScore(m.arg) : m.kind === "pre" ? X.preview(m.arg) : m.kind === "html" ? m.arg : "";
  var keepScroll = host.querySelector(".dy-modal"), st = keepScroll ? keepScroll.scrollTop : 0;
  host.innerHTML = '<div class="dy-modal" data-a="bgclose"><div class="dlg dy" role="dialog" aria-modal="true"><button class="xclose" data-a="close" aria-label="Close">×</button>' + body + '</div></div>';
  document.body.style.overflow = "hidden";
  if (keepScroll && m.keep) host.querySelector(".dy-modal").scrollTop = st;
  m.keep = false;
  if (m.kind === "box" && m.live && !U.liveT){ var mp0 = m.arg.maps[m.cur]; if (mp0 && mp0.ev && m.evN < mp0.ev.length) X.startLive(); }
};

/* =====================================================================================
   PLAYER CARD
   ===================================================================================== */
var ATTR_COL = {gun:"", hp:"c2", snd:"c3", ctl:"c4", obj:""};
X.playerCard = function(id){
  var g = G(), p = P(id), m = U.modal, tab = m.tab || "ov";
  if (!p) return '<div class="dlg-b">Player not found.</div>';
  var hidden = DY.hiddenOvr(p), t = p.team != null ? T(p.team) : null;
  var accN = function(a){ return p.acc.filter(function(x){ return x.a === a; }).length; };
  var trophies = [["MVP", "MVP"], ["CHAMP", "🏆"], ["AS1", "AS1"], ["AS2", "AS2"], ["FMVP", "FMVP"], ["ROY", "ROY"], ["MIP", "MIP"]].map(function(x){ var n = accN(x[0]); return n ? '<span class="badge gold">' + x[1] + (n > 1 ? "×" + n : "") + '</span>' : ""; }).join("");
  var h = '<div class="dlg-h"><div style="min-width:0;flex:1 1 300px"><div class="row" style="gap:8px">' + X.role(p) + (p.real ? '<span class="badge" title="Built from his real BTL career">BTL original</span>' : '') + (p.rookie && p.rookie.cls ? '<span class="badge rk">' + (p.yrs <= 0 ? "Prospect #" + p.rookie.rank : "Class of S" + p.rookie.cls) + '</span>' : '') + (p.trq ? '<span class="badge red">Trade request</span>' : '') + X.formTag(p) + '</div>' +
    '<div class="pc-name">' + esc(p.n) + (g.hof.indexOf(id) >= 0 ? ' <span class="badge gold">Hall of Fame</span>' : '') + '</div>' +
    '<div class="pc-sub"><span>' + X.statusLine(p) + '</span><span>' + DY.stage(p) + (p.status !== "retired" ? ' · ' + (p.yrs <= 0 ? "first season" : p.yrs + " season" + (p.yrs > 1 ? "s" : "") + " in the league") : '') + '</span><span>' + esc(p.persona) + '</span></div>' + (trophies ? '<div class="row" style="gap:4px;margin-top:6px">' + trophies + '</div>' : '') + '</div>' +
    '<div class="pc-ovr"><div class="box"><div class="v">' + (hidden ? "??" : Math.round(p.ovr)) + '</div><div class="k">Overall</div></div><div class="box"><div class="v" style="font-size:26px">' + esc(p.potG) + '</div><div class="k">Potential</div></div><div class="box"><div class="v" style="font-size:22px">' + f1(p.legacy || 0) + '</div><div class="k">Legacy</div></div></div></div>';
  h += '<div class="dlg-b"><div class="subtabs">' + [["ov", "Overview"], ["st", "Stats"], ["acc", "Accolades"], ["hist", "History"]].map(function(x){ return '<button class="chip" data-a="ptab" data-arg="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (tab === "ov") h += pcOverview(p); else if (tab === "st") h += pcStats(p); else if (tab === "acc") h += pcAcc(p); else h += pcHist(p);
  return h + '</div>';
};
function pcOverview(p){
  var g = G(), hidden = DY.hiddenOvr(p), h = '<div class="grid2">';
  // skills
  var sk = hidden ? '<p class="muted" style="margin:0 0 8px">Skill ratings unlock when he signs and a new season starts. Scouting report:</p>' + X.kv("Prospect rank", "#" + p.rookie.rank + " in the Season " + p.rookie.cls + " class") + X.kv("Scouted overall", "~" + Math.round(p.rookie.est)) + X.kv("Amateur K/D", f2(p.rookie.scout.kd)) + X.kv("Respawn K/D", f2(p.rookie.scout.resp)) + X.kv("SnD K/D", f2(p.rookie.scout.snd)) + X.kv("Interactions / map", f1(p.rookie.scout.ip)) + X.kv("Maps scouted", p.rookie.scout.maps)
    : '<div class="bars">' + DY.ATTR.map(function(k){ return X.bar(DY.ATTR_NAME[k], p.at[k], 99, ATTR_COL[k]); }).join("") + '</div>';
  h += '<div class="card"><h3>Skillset</h3>' + sk + '</div>';
  var tr = '<div class="bars">' + X.bar("Entry / first bloods", p.entry, 100, "c3") + X.bar("Clutch", p.clutch, 100, "c2") + X.bar("Consistency", p.cons, 100, "c4") + X.bar("Leadership", p.lead, 100) + X.bar("Teammate", p.chem, 100, "c4") + X.bar("Work ethic", p.work, 100, "c2") + X.bar("Availability", 100 - p.avail * 600, 100, "", Math.round((1 - p.avail) * 100) + "%") + '</div>';
  h += '<div class="card"><h3>Traits</h3>' + tr + '</div>';
  // personality
  var pr = p.pri;
  h += '<div class="card"><h3>Personality · ' + esc(p.persona) + '</h3><p class="note">' + esc(DY.PERSONA_TEXT[p.persona] || "") + '</p><div class="bars" style="margin-top:10px">' + X.bar("Money", pr.money * 100, 60, "", Math.round(pr.money * 100) + "%") + X.bar("Winning", pr.win * 100, 60, "c4", Math.round(pr.win * 100) + "%") + X.bar("Loyalty", pr.loyal * 100, 60, "c2", Math.round(pr.loyal * 100) + "%") + X.bar("Playing time", pr.pt * 100, 60, "c3", Math.round(pr.pt * 100) + "%") + '</div>' + (p.rookie && p.rookie.holdout && p.team == null ? '<p class="note" style="margin-top:8px">Wants to start his career on a contender. May sit on early offers from weaker teams.</p>' : '') + '</div>';
  // contract
  var c = p.con, mv = p.status !== "retired" ? DY.marketValue(p) : 0;
  var ch = '<div class="card"><h3>Contract & relationship</h3>';
  if (p.status === "retired") ch += X.kv("Retired", "Season " + p.retiredS) + (p.lastTeam ? X.kv("Last team", esc(p.lastTeam)) : "");
  else {
    ch += X.kv("Contract", c ? DY.conText(c) : "None") + X.kv("Market value", money(mv) + " / season") + X.kv("Asking (approx.)", money(DY.askFor(p, p.team != null ? p.team : g.user)));
    if (p.ext && p.ext.sal) ch += X.kv("Extension signed", money(p.ext.sal) + ", " + DY.CON_TYPES[p.ext.type]);
    if (p.team != null) ch += '<div class="kv"><span>Relationship with ' + esc(T(p.team).abbr) + '</span><span style="flex:0 0 120px">' + X.meter(p.rel) + '</span></div>' + X.kv("Seasons with team", p.tenure || 0);
  }
  ch += '</div>';
  h += ch + '</div>';
  h += '<div class="card"><h3>Scouting report</h3><p class="note" style="border-left-color:var(--mustard)">' + X.report(p).map(esc).join(" ") + '</p></div>';
  var rvs = DY.playerRivals(p, 3);
  if (rvs.length) h += '<div class="card"><h3>Biggest rivals</h3>' + X.table(["Rival", {h:"Series", n:1}, {h:"His K/D vs", n:1, t:"His K/D in those series"}, {h:"Rival K/D", n:1}, {h:"Playoffs", n:1}], rvs.map(function(x){ var r = x.r; return '<tr><td>' + X.role(x.q) + ' ' + X.pl(x.q.id) + ' <span class="sm">' + (x.q.status === "retired" ? "Retired" : x.q.team != null ? esc(T(x.q.team).abbr) : "FA") + '</span></td><td class="n"><b>' + r[1] + '-' + (r[0] - r[1]) + '</b></td><td class="n">' + f2(kd(r[2], r[3])) + '</td><td class="n">' + f2(kd(r[4], r[5])) + '</td><td class="n">' + (r[6] || "") + '</td></tr>'; })) + '<p class="sm" style="margin:6px 0 0">Ranked by how often they meet, playoff meetings and how close it is. Series record is from ' + esc(p.n) + "'s side.</p></div>";
  var tr = trend(p), mp = mapRows(p);
  if (tr || mp) h += '<div class="grid2">' + (tr ? '<div class="card"><h3>Form · last ' + tr.list.length + ' series ' + X.trendTag(p) + '</h3><div class="row" style="gap:6px">' + tr.list.map(function(x){ var v = x[1] ? x[0] / x[1] : x[0]; return '<span class="pill ' + (v >= 1.15 ? "good" : v < 0.9 ? "bad" : "") + '"><b>' + f2(v) + '</b></span>'; }).join("") + '</div><p class="sm" style="margin:6px 0 0">K/D by series, oldest to newest. Last 5: ' + f2(tr.kd) + '.</p></div>' : '') + (mp || '') + '</div>';
  h += X.playerActions(p);
  return h;
}
function mapRows(p){
  var aff = Object.keys(p.maps || {}).map(function(k){ return [k, p.maps[k]]; }).sort(function(x, y){ return y[1] - x[1]; });
  var rl = p.realLine && p.realLine.maps ? Object.keys(p.realLine.maps).map(function(k){ var v = p.realLine.maps[k]; return [k, v]; }).filter(function(x){ return x[1][2] + x[1][3] >= 3; }) : [];
  if (!aff.length && !rl.length) return "";
  var lab = function(k){ var x = k.split("|"); return x[1] + " " + (x[0] === "SND" ? "SnD" : x[0]); };
  var h = '<div class="card"><h3>Maps</h3>';
  if (aff.length){ var good = aff.filter(function(x){ return x[1] > 0; }).slice(0, 3), bad = aff.filter(function(x){ return x[1] < 0; }).slice(-2); h += (good.length ? '<div class="sm">Best: ' + good.map(function(x){ return '<b style="color:var(--ok)">' + esc(lab(x[0])) + '</b>'; }).join(", ") + '</div>' : '') + (bad.length ? '<div class="sm">Weakest: ' + bad.map(function(x){ return '<b style="color:#ff6a5e">' + esc(lab(x[0])) + '</b>'; }).join(", ") + '</div>' : ''); }
  if (rl.length) h += '<div style="margin-top:6px">' + X.table(["Real S5–S6", {h:"K/D", n:1}, {h:"W-L", n:1}], rl.sort(function(x, y){ return (y[1][2] + y[1][3]) - (x[1][2] + x[1][3]); }).slice(0, 6).map(function(x){ return '<tr><td>' + esc(lab(x[0])) + '</td><td class="n">' + f2(x[1][0] / Math.max(1, x[1][1])) + '</td><td class="n">' + x[1][2] + '-' + x[1][3] + '</td></tr>'; })) + '</div>';
  return h + '</div>';
}
function pcStats(p){
  var rows = [];
  p.car.slice().reverse().forEach(function(c){
    var reg = DY.uS(c.reg), po = DY.uS(c.po), mi = DY.uS(c.mi);
    if (c.lvl === "BTL" && reg){ var t = {}; DY.STK.forEach(function(k){ t[k] = (reg[k] || 0) + (po ? po[k] || 0 : 0); }); t.best = Math.max(reg.best || 0, po ? po.best || 0 : 0); rows.push(row(c.s, c.tm, "BTL", c.ovr, c.so, X.sLine(t), c.fin, po ? po.m : 0)); }
    if (mi && mi.m) rows.push(row(c.s, c.lvl === "ACA" ? c.tm : "ACA", "Academy", c.lvl === "ACA" ? c.ovr : "", c.lvl === "ACA" ? c.so : "", X.sLine(mi), null, 0, true));
  });
  function row(sz, tm, lvl, ovr, so, s, fin, pom, aca){ return '<tr' + (aca ? ' class="out"' : '') + '><td class="n">S' + sz + '</td><td>' + esc(tm || "—") + (aca && lvl === "Academy" ? ' <span class="badge">ACA</span>' : '') + '</td><td class="n">' + (ovr || "") + '</td><td class="n">' + (so || "—") + '</td><td class="n">' + s.m + (pom ? '<small> (' + pom + ' PO)</small>' : '') + '</td><td class="n"><b>' + f2(s.kd) + '</b></td><td class="n">' + (s.hp != null ? f2(s.hp) : "—") + '</td><td class="n">' + (s.snd != null ? f2(s.snd) : "—") + '</td><td class="n">' + (s.ctl != null ? f2(s.ctl) : "—") + '</td><td class="n">' + (s.hill != null ? f0(s.hill) : "—") + '</td><td class="n">' + (s.fb != null ? f2(s.fb) : "—") + '</td><td class="n">' + (s.sobj != null ? f2(s.sobj) : "—") + '</td><td class="n">' + (s.ok != null ? f1(s.ok) : "—") + '</td><td class="n">' + f2(s.war) + '</td><td class="n">' + (fin ? finTxt(fin) : "") + '</td></tr>'; }
  // the season in progress
  if (p.st && p.status !== "retired" && (p.st.reg.m || p.st.po.m || p.st.mi.m)){
    var g = G(), cur = [];
    if (p.st.reg.m || p.st.po.m){ var t = {}; DY.STK.forEach(function(k){ t[k] = (p.st.reg[k] || 0) + (p.st.po[k] || 0); }); cur.push(row(g.season, p.team != null ? T(p.team).abbr : "—", "BTL", Math.round(p.preOvr || p.ovr), DY.seasonOvr(t), X.sLine(t), null, p.st.po.m)); }
    if (p.st.mi.m) cur.push(row(g.season, p.minor != null && g.minors[p.minor] ? g.minors[p.minor].abbr : "ACA", "Academy", "", "", X.sLine(p.st.mi), null, 0, true));
    rows = cur.concat(rows);
  }
  return '<p class="sm" style="margin:0">One row per season (regular season + playoffs). Faded rows are Academy. Szn OVR is how he actually played that year.</p>' + X.table([{h:"Szn", n:1}, "Team", {h:"OVR", n:1}, {h:"Szn OVR", n:1}, {h:"Maps", n:1}, {h:"K/D", n:1}, {h:"HP", n:1}, {h:"SnD", n:1}, {h:"CTL", n:1}, {h:"Hill/HP", n:1}, {h:"FB/SnD", n:1}, {h:"P+D/SnD", n:1}, {h:"ObjK/CTL", n:1}, {h:"WAR+", n:1}, {h:"Finish", n:1}], rows);
}
var finTxt = X.finTxt = function(f){ return f === 1 ? "🏆 1st" : f === 2 ? "2nd" : f === 3 ? "3rd" : f === 4 ? "4th" : f <= 6 ? "5-6th" : f <= 8 ? "7-8th" : f <= 12 ? "9-12th" : "Pool exit"; };
function pcAcc(p){
  var parts = DY.legacyParts(p), h = '<div class="grid3"><div class="card"><h3>Legacy score · ' + f1(DY.legacy(p)) + '</h3>' + X.kv("Talent & skill", f1(parts.talent)) + X.kv("Statistical dominance", f1(parts.stats)) + X.kv("Accolades", f1(parts.acc)) + '<p class="sm" style="margin:8px 0 0">' + esc(DY.HOF_RULE) + '</p></div>';
  var counts = {}; p.acc.forEach(function(a){ counts[a.a] = (counts[a.a] || 0) + 1; });
  h += '<div class="card"><h3>Trophy case</h3>' + (Object.keys(counts).length ? Object.keys(counts).sort(function(a, b){ return (DY.ACC_PTS[b] || 0) - (DY.ACC_PTS[a] || 0); }).map(function(k){ return X.kv(DY.ACC_NAME[k], "×" + counts[k]); }).join("") : '<p class="empty">No accolades yet.</p>') + '</div></div>';
  h += X.table([{h:"Season", n:1}, "Award", "Team"], p.acc.slice().reverse().map(function(a){ return '<tr><td class="n">S' + a.s + '</td><td>' + DY.ACC_NAME[a.a] + '</td><td>' + esc(a.t || "—") + '</td></tr>'; }));
  return h;
}
function pcHist(p){
  var vals = p.ovrH.map(function(x){ return x.o; }).concat(p.status !== "retired" ? [Math.round(p.ovr)] : []);
  var h = '<div class="card"><h3>Overall by season</h3>' + (vals.length > 1 ? X.spark(vals, 420, 70) + '<div class="sm">' + p.ovrH.map(function(x){ return "S" + x.s + ": " + x.o; }).join(" · ") + (p.status !== "retired" ? " · now: " + Math.round(p.ovr) : "") + '</div>' : '<p class="empty">One season so far.</p>') + '</div>';
  h += '<div class="card"><h3>Storyline</h3><ul class="logl">' + (p.log.length ? p.log.map(function(l){ return '<li><span class="num muted">S' + l.s + ' ' + esc(l.w) + '</span> ' + esc(l.t) + '</li>'; }).join("") : '<li class="muted">Nothing yet.</li>') + '</ul></div>';
  return h;
}
/* context actions on the player card */
X.playerActions = function(p){
  var g = G(), u = DY.userT(), h = "";
  if (p.status === "retired") return "";
  if (p.team === u.id){
    var onB = (g.block || []).indexOf(p.id) >= 0;
    h += '<div class="card"><h3>Manage</h3><div class="row">' + (g.phase !== "playoffs" ? X.btn("release", "Release", "ghost sm", p.id, false, "His salary this season stays on your books as dead money") : "") + X.btn("blockToggle", onB ? "Remove from trade block" : "Put on trade block", onB ? "primary sm" : "ghost sm", p.id) + X.btn("tradeAdd", "Build a trade", "ghost sm", p.id) + '</div>' + (p.con && g.phase !== "playoffs" ? '<p class="sm" style="margin:8px 0 0">Releasing him leaves ' + money(p.con.sal) + ' of dead money on this season\'s budget.</p>' : '') + '</div>';
    return h;
  }
  if (p.team != null){ var onT = (g.targets || []).indexOf(p.id) >= 0; if (g.phase !== "playoffs") h += '<div class="card"><h3>Trade</h3><div class="row">' + X.btn("targetToggle", onT ? "Remove from targets" : "Add to trade targets", onT ? "primary sm" : "ghost sm", p.id) + X.btn("tradeFor", "Build a trade", "ghost sm", p.id) + '<span class="sm">' + esc(T(p.team).name) + ' are ' + X.tagChip(T(p.team).tag) + (T(p.team).rivals.indexOf(u.id) >= 0 ? ' · pool rival (they charge a premium)' : '') + '</span></div></div>'; return h; }
  // free agent
  if (g.phase === "offseason" && g.off.stage === "fa") return X.negotiation(p, "fa");
  if (g.phase === "season" || g.phase === "preseason") return X.negotiation(p, "sign");
  if (g.phase === "offseason") return '<div class="card"><p class="muted" style="margin:0">Free agency opens after option decisions. ' + (p.rookie && p.rookie.hidden ? "Rookies sign in free agency too." : "") + '</p></div>';
  return '<div class="card"><p class="muted" style="margin:0">Rosters are locked for the playoffs.</p></div>';
};
var TYPES = ["1", "2G", "1+1T", "1+1P"];
X.negotiation = function(p, mode, ext){
  var g = G(), u = DY.userT(), ask = DY.askFor(p, u.id), id = p.id;
  var prev = mode === "fa" ? DY.faOffersFor(id).find(function(o){ return o.user; }) : mode === "ext" ? g.ext[id] : null;
  var sal = prev ? prev.sal : ask, type = prev ? prev.type : (p.age >= 28 ? "2G" : "1+1T");
  var h = '<div class="card"><h3>' + (mode === "fa" ? "Make an offer" : mode === "ext" ? "Extension" : "Sign him now") + '</h3>';
  h += '<div class="row sm" style="margin-bottom:8px">Asking about <b style="color:var(--mustard)">&nbsp;' + money(ask) + '&nbsp;</b> per season · market value ' + money(DY.marketValue(p)) + ' · your space ' + money(DY.space(u) - (mode === "fa" ? DY.committed(u) - (prev ? prev.sal : 0) : 0)) + '</div>';
  h += '<div class="row" style="align-items:flex-end"><label class="fld">Salary ($k / season)<input type="number" id="neg-sal-' + id + '" min="50" max="1000" step="5" value="' + sal + '"></label><label class="fld">Contract<select id="neg-type-' + id + '">' + TYPES.map(function(k){ return '<option value="' + k + '"' + (k === type ? " selected" : "") + '>' + DY.CON_TYPES[k] + '</option>'; }).join("") + '</select></label>';
  if (mode === "sign" && u.roster.length >= DY.ROSTER) h += '<label class="fld">Release to make room<select id="neg-drop-' + id + '">' + u.roster.map(function(i){ var q = P(i); return '<option value="' + i + '">' + esc(q.n) + ' (' + q.role + ', ' + Math.round(q.ovr) + ', ' + money(q.con ? q.con.sal : 0) + ' dead)</option>'; }).join("") + '</select></label>';
  h += X.btn(mode === "fa" ? "faOffer" : mode === "ext" ? "extOffer" : "signNow", mode === "fa" ? (prev ? "Update offer" : "Submit offer") : mode === "ext" ? (prev ? "Update offer" : "Offer extension") : "Sign", "primary sm", id) + (prev && mode === "fa" ? X.btn("faWithdraw", "Withdraw", "ghost sm", id) : "") + '</div>';
  var fb = U.fb && U.fb[id];
  var shown = fb || (prev && prev.tone ? {tone:prev.tone, why:prev.why || [], rank:prev.ranked, of:prev.of} : null);
  if (shown) h += '<div class="fb" style="margin-top:10px"><div>Feedback: <span class="tone ' + X.toneCls(shown.tone) + '">' + esc(shown.tone) + '</span>' + (shown.no ? ' — he turned it down.' : '') + '</div>' + (shown.why && shown.why.length ? '<ul class="logl" style="margin:0">' + shown.why.map(function(w){ return '<li>· ' + esc(w[1]) + '</li>'; }).join("") + '</ul>' : '') + (mode !== "sign" ? '<div class="sm">Feedback is a read on his mood, not a promise. ' + (mode === "fa" ? "Players decide at the end of each week." : "He answers at the end of the week.") + '</div>' : '') + '</div>';
  if (mode === "fa"){
    var offers = DY.faOffersFor(id);
    h += '<div style="margin-top:10px"><div class="label" style="margin-bottom:6px">Offers on the table (' + offers.length + ')</div>' + (offers.length ? '<ul class="logl" style="margin:0">' + offers.slice().sort(function(a, b){ return b.sal - a.sal; }).map(function(o){ var t = T(o.tid); return '<li>' + X.tm(o.tid) + ' ' + X.tagChip(t.tag) + ' — <b class="num">' + money(o.sal) + '</b> · ' + DY.CON_TYPES[o.type] + (o.raised ? ' <span class="badge red">raised</span>' : '') + (o.user ? ' <span class="badge gold">You</span>' : '') + '</li>'; }).join("") + '</ul>' : '<p class="empty">No offers yet.</p>') + '</div>';
  }
  return h + '</div>';
};

/* =====================================================================================
   TEAM PAGE
   ===================================================================================== */
X.teamPage = function(tid){
  var g = G(), t = T(tid), tab = U.modal.tab || "roster", fm = DY.fanMetrics(t);
  var h = '<div class="dlg-h"><div class="hub-title">' + X.logo(t, 56) + '<div><div class="pc-name">' + esc(t.name) + (t.user ? ' ★' : '') + '</div><div class="pc-sub"><span>' + DY.POOL_NAME[t.pool] + ' pool</span><span>' + X.tagChip(t.tag) + '</span><span>' + (t.titles ? "🏆 ×" + t.titles : "No titles yet") + '</span>' + (g.phase !== "draft" ? '<span>' + t.w + '-' + t.l + ' this season</span>' : '') + '</div></div></div>' +
    '<div class="pc-ovr"><div class="box"><div class="v" style="font-size:24px">' + f1(DY.teamRating(t)) + '</div><div class="k">Team OVR</div></div><div class="box"><div class="v" style="font-size:24px">' + fm.eng + '</div><div class="k">Fan engagement</div></div></div></div>';
  h += '<div class="dlg-b"><div class="subtabs">' + [["roster", "Roster"], ["rivals", "Rivals"], ["maps", "Maps & modes"], ["hist", "Season by season"], ["leg", "Top 10 legacy"], ["biz", "Fans & money"]].map(function(x){ return '<button class="chip" data-a="ttab" data-arg="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (tab === "roster"){
    h += X.table(["Player", "Pos", {h:"OVR", n:1}, {h:"POT", n:1}, "Stage", "Contract", {h:"K/D", n:1}, {h:"WAR+", n:1}, ""], t.roster.slice().sort(function(a, b){ return P(b).ovr - P(a).ovr; }).map(function(id){ var p = P(id), s = p.st ? X.sLine(p.st.reg) : null; return '<tr><td>' + X.pl(id) + (t.lineup.indexOf(id) < 0 ? ' <span class="badge">Sub</span>' : '') + (p.trq ? ' <span class="badge red">TR</span>' : '') + '</td><td>' + X.role(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="n">' + X.pot(p) + '</td><td>' + DY.stage(p) + '</td><td class="sm">' + DY.conText(p.con) + '</td><td class="n">' + (s ? f2(s.kd) : "—") + '</td><td class="n">' + (s ? f2(s.war) : "—") + '</td><td>' + X.formTag(p) + '</td></tr>'; }));
    var modes = DY.MODES.map(function(m){ return X.bar(DY.MODE_NAME[m], DY.modeRating(t, m), 99, m === "HP" ? "c2" : m === "SND" ? "c3" : "c4", f1(DY.modeRating(t, m))); }).join("");
    h += '<div class="grid2"><div class="card"><h3>Mode strength (starting four)</h3><div class="bars">' + modes + '</div></div><div class="card"><h3>Payroll</h3>' + X.kv("Budget", money(t.budget + (t.cashAdj || 0))) + X.kv("Payroll", money(DY.payroll(t))) + X.kv("Space", money(DY.space(t))) + (t.dead ? X.kv("Dead money", money(t.dead)) : "") + '</div></div>';
  } else if (tab === "rivals"){
    var top = DY.teamRivals(t, 3);
    h += top.length ? '<div class="grid3">' + top.map(function(x, i){ var r = x.r; return '<div class="card" data-a="team" data-arg="' + x.t.id + '" style="cursor:pointer"><div class="row" style="gap:10px">' + X.logo(x.t, 40) + '<div><div class="alab">Rival #' + (i + 1) + (x.t.pool === t.pool ? ' · pool rival' : '') + '</div><b>' + esc(x.t.name) + '</b></div></div><div class="big num" style="margin-top:8px">' + r.w + '-' + r.l + '</div><div class="sm">Maps ' + r.mw + '-' + r.ml + (r.po ? ' · ' + r.po + ' playoff meeting' + (r.po > 1 ? "s" : "") : '') + (r.gf ? ' · ' + r.gf + ' grand final' + (r.gf > 1 ? "s" : "") : '') + '</div>' + (r.ko || r.kod ? '<div class="sm">Eliminated them ' + r.ko + '× · eliminated by them ' + r.kod + '×</div>' : '') + '<div class="sm">Last met: Season ' + r.last + '</div></div>'; }).join("") + '</div>' : '<p class="empty">Rivalries build up over time. Play a few more series.</p>';
    var all = Object.keys(t.rv || {}).map(function(id){ return {o:T(+id), r:t.rv[id]}; }).sort(function(a, b){ return (b.r.w + b.r.l) - (a.r.w + a.r.l); });
    if (all.length) h += '<div class="label" style="margin:12px 0 4px">All-time head to head</div>' + X.table(["Opponent", {h:"Series", n:1}, {h:"Maps", n:1}, {h:"Playoffs", n:1}, {h:"KOs", n:1, t:"Times you eliminated them / they eliminated you"}], all.map(function(x){ var r = x.r; return '<tr><td>' + X.logo(x.o, 20) + ' ' + X.tm(x.o.id) + '</td><td class="n"><b>' + r.w + '-' + r.l + '</b></td><td class="n">' + r.mw + '-' + r.ml + '</td><td class="n">' + (r.po || "") + '</td><td class="n">' + (r.ko || r.kod ? r.ko + '/' + r.kod : "") + '</td></tr>'; }));
  } else if (tab === "maps"){
    var R = (t.mrec && t.mrec.s) || {}, rows2 = [];
    DY.MODES.forEach(function(md){ var r = R[md] || [0, 0]; rows2.push('<tr class="me"><td><b>' + DY.MODE_NAME[md] + '</b></td><td class="n"><b>' + r[0] + '-' + r[1] + '</b></td><td class="n">' + (r[0] + r[1] ? Math.round(r[0] / (r[0] + r[1]) * 100) + "%" : "—") + '</td></tr>');
      Object.keys(DY.MAP_W[md]).forEach(function(mp){ var x = R[md + "|" + mp]; if (!x) return; rows2.push('<tr><td style="padding-left:22px">' + esc(mp) + '</td><td class="n">' + x[0] + '-' + x[1] + '</td><td class="n">' + Math.round(x[0] / (x[0] + x[1]) * 100) + '%</td></tr>'); }); });
    var fav = []; t.lineup.forEach(function(id){ var p = P(id); Object.keys(p.maps || {}).forEach(function(k){ if (p.maps[k] >= 1) fav.push(esc(p.n) + " on " + esc(k.split("|")[1]) + " " + (k[0] === "S" ? "SnD" : k.split("|")[0])); }); });
    h += '<p class="sm" style="margin:0">Map and mode records this season (regular season + playoffs).</p>' + X.table(["Mode / map", {h:"W-L", n:1}, {h:"Win %", n:1}], rows2) + (fav.length ? '<p class="sm">Map specialists in the lineup: ' + fav.slice(0, 6).join(" · ") + '.</p>' : '');
  } else if (tab === "hist"){
    h += X.table([{h:"Season", n:1}, "Record", {h:"Maps", n:1}, "Pool", "Finish", "Tag", {h:"Budget", n:1}, {h:"Fans", n:1}, "Roster"], t.hist.slice().reverse().map(function(r){ return '<tr' + (r.fin === 1 ? ' class="me"' : '') + '><td class="n">S' + r.s + '</td><td>' + r.w + '-' + r.l + '</td><td class="n">' + r.mw + '-' + r.ml + '</td><td>' + DY.POOL_NAME[r.pool] + ' #' + r.place + '</td><td>' + finTxt(r.fin) + '</td><td>' + esc(r.tag) + '</td><td class="n">' + money(r.budget) + '</td><td class="n">' + r.eng + '</td><td class="sm">' + r.roster.map(function(i){ return X.pl(i); }).join(", ") + '</td></tr>'; }));
  } else if (tab === "leg"){
    var ids = DY.allP().filter(function(p){ return p.prevTeams.indexOf(tid) >= 0 || p.team === tid; }).sort(function(a, b){ return b.legacy - a.legacy; }).slice(0, 10);
    h += '<p class="sm" style="margin:0">Everyone who has played for ' + esc(t.name) + ' in this dynasty, ranked by Legacy Score.</p>' + X.table([{h:"#", n:1}, "Player", "Pos", {h:"Legacy", n:1}, "Status", "Accolades"], ids.map(function(p, i){ var c = function(a){ return p.acc.filter(function(x){ return x.a === a; }).length; }; return '<tr><td class="n">' + (i + 1) + '</td><td>' + X.pl(p.id) + '</td><td>' + X.role(p) + '</td><td class="n"><b>' + f1(p.legacy) + '</b></td><td class="sm">' + (p.status === "retired" ? "Retired" : p.team === tid ? "Current" : p.team != null ? esc(T(p.team).abbr) : "FA") + '</td><td class="sm">' + [c("MVP") ? "MVP×" + c("MVP") : "", c("CHAMP") ? "🏆×" + c("CHAMP") : "", c("AS1") + c("AS2") ? "AS×" + (c("AS1") + c("AS2")) : ""].filter(Boolean).join(" ") + '</td></tr>'; }));
  } else {
    h += '<div class="grid4">' + [["Fan engagement", fm.eng + " / 100"], ["Avg viewers", fm.viewers.toLocaleString()], ["Merch sales", money(fm.merch)], ["Social followers", fm.social.toLocaleString()], ["Market size", t.mkt >= 1.2 ? "Large" : t.mkt >= 0.95 ? "Medium" : "Small"], ["Budget this season", money(t.budget)]].map(function(x){ return '<div class="card"><div class="label">' + x[0] + '</div><div class="big num">' + x[1] + '</div></div>'; }).join("") + '</div><p class="sm">Winning, stars and deep playoff runs grow fan engagement. Engagement sets next season\'s budget (' + money(DY.BUDGET_MIN) + '–' + money(DY.BUDGET_MAX) + '). Losing teams see engagement and revenue fall, and players who care about winning notice.</p>';
  }
  return h + '</div>';
};

/* =====================================================================================
   BOX SCORE (with a live map-by-map reveal for your own matches)
   ===================================================================================== */
var OBJH = {HP:"Hill", SND:"Plt/Def/FB", CTL:"Obj K"};
/* Match preview (before the series is played) */
X.preview = function(arg){
  var g = G(), A = T(arg.a), B = T(arg.b), ra = DY.teamRating(A), rb = DY.teamRating(B), pa = 1 / (1 + Math.exp(-(ra - rb) / 3.2));
  var side = function(t){ return '<div class="side">' + X.logo(t, 54) + '<span class="nm">' + X.tm(t.id) + '</span><span class="x">' + t.w + '-' + t.l + ' · OVR ' + f1(DY.teamRating(t)) + '</span>' + X.tagChip(t.tag) + '</div>'; };
  var cmp = DY.MODES.map(function(m){ var x = DY.modeRating(A, m), y = DY.modeRating(B, m), rx = A.mrec && A.mrec.s && A.mrec.s[m], ry = B.mrec && B.mrec.s && B.mrec.s[m]; return '<div class="cmp"><span class="nv">' + f1(x) + '</span><div class="l"><i style="width:' + Math.min(100, Math.max(4, (x - 70) * 3.5)) + '%"></i></div><span class="m">' + m + '<br><small>' + (rx ? rx[0] + "-" + rx[1] : "0-0") + ' | ' + (ry ? ry[0] + "-" + ry[1] : "0-0") + '</small></span><div class="r"><i style="width:' + Math.min(100, Math.max(4, (y - 70) * 3.5)) + '%"></i></div><span class="nv">' + f1(y) + '</span></div>'; }).join("");
  var lu = function(t){ return t.lineup.map(function(id){ var p = P(id); return '<tr><td>' + X.role(p) + ' ' + X.pl(id) + ' ' + X.trendTag(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="n">' + (p.st && p.st.reg.m ? f2(kd(p.st.reg.k, p.st.reg.d)) : "—") + '</td></tr>'; }).join(""); };
  var key = function(t){ var p = t.lineup.map(P).sort(function(x, y){ return (y.ovr + y.hot) - (x.ovr + x.hot); })[0]; return p ? X.pl(p.id) : "—"; };
  var fav = pa >= 0.5 ? A : B, pct = Math.round(Math.max(pa, 1 - pa) * 100);
  var pickTxt = pct >= 70 ? fav.name + " should handle this one." : pct >= 58 ? "I like " + fav.name + ", but this is no gimme." : "Coin flip. Give me " + fav.name + " by a hair.";
  return '<div class="dlg-h" style="display:block"><div class="label" style="text-align:center">' + esc(arg.title) + '</div><div class="vs" style="margin-top:10px">' + side(A) + '<div class="x">VS</div>' + side(B) + '</div></div><div class="dlg-b">' +
    '<div class="card"><div class="row between"><b>Series odds</b><span class="num">' + esc(A.abbr) + ' ' + Math.round(pa * 100) + '% · ' + esc(B.abbr) + ' ' + Math.round((1 - pa) * 100) + '%</span></div><div class="meter" style="margin-top:6px;height:8px"><i style="width:' + Math.round(pa * 100) + '%;background:' + (A.c1 || "var(--mustard)") + '"></i></div><p class="sm" style="margin:8px 0 0"><b style="color:var(--text)">Stephen A. Sizzle:</b> ' + esc(pickTxt) + '</p></div>' +
    (function(){ var r = A.rv && A.rv[B.id]; if (!r) return '<div class="card"><b>First meeting</b> <span class="sm">between these franchises in this dynasty.</span></div>'; var hot = DY.teamRivals(A, 3).some(function(x){ return x.t.id === B.id; }) || DY.teamRivals(B, 3).some(function(x){ return x.t.id === A.id; }); return '<div class="card">' + (hot ? '<span class="badge red">RIVALRY</span> ' : '') + '<b>All-time: ' + esc(A.abbr) + ' ' + r.w + '-' + r.l + '</b> <span class="sm">· maps ' + r.mw + '-' + r.ml + (r.po ? ' · ' + r.po + ' playoff meeting' + (r.po > 1 ? "s" : "") : '') + (r.ko ? ' · ' + esc(A.abbr) + ' eliminated them ' + r.ko + '×' : '') + (r.kod ? ' · ' + esc(B.abbr) + ' eliminated them ' + r.kod + '×' : '') + '</span></div>'; })() +
    '<div class="card"><h3>Mode strength · season mode records</h3>' + cmp + '<p class="sm" style="margin:8px 0 0">Best of 5: Hardpoint, SnD, Control, Hardpoint, SnD.</p></div>' +
    '<div class="grid2"><div><div class="label" style="margin-bottom:4px">' + esc(A.name) + ' · key player ' + key(A) + '</div>' + X.table(["", {h:"OVR", n:1}, {h:"K/D", n:1}], [lu(A)]) + '</div><div><div class="label" style="margin-bottom:4px">' + esc(B.name) + ' · key player ' + key(B) + '</div>' + X.table(["", {h:"OVR", n:1}, {h:"K/D", n:1}], [lu(B)]) + '</div></div>' +
    '<div class="row" style="justify-content:flex-end">' + X.btn("simMatch", "Sim to result", "ghost") + X.btn("startMatch", "Start match", "primary") + '</div></div>';
};
/* Box score / live match: map by map, with play-by-play for your own matches */
X.boxScore = function(rec){
  var g = G(), A = T(rec.a), B = T(rec.b), m = U.modal, total = rec.maps.length, live = !!m.live;
  var cur = live ? m.cur : total, evN = live ? m.evN : 1e9;
  var mapDone = function(i){ if (!live) return true; if (i < cur) return true; if (i > cur) return false; var ev = rec.maps[i].ev; return !ev || evN >= ev.length; };
  var sa = 0, sb = 0; rec.maps.forEach(function(mp, i){ if (mapDone(i)) mp.aw ? sa++ : sb++; });
  var over = rec.maps.every(function(mp, i){ return mapDone(i); });
  var pre = rec.pre || [[A.w, A.l], [B.w, B.l]];
  var title = rec.id ? DY.PO[rec.id].r : (rec.r != null ? "Week " + (Math.floor(rec.r / 2) + 1) + " · Match " + (rec.r % 2 + 1) + (rec.pool ? " · Pool game" : "") : "");
  var h = '<div class="dlg-h" style="display:block"><div class="label" style="text-align:center">' + esc(title) + (live && !over ? ' · <span style="color:var(--red)">LIVE</span>' : '') + '</div><div class="vs" style="margin-top:8px"><div class="side">' + X.logo(A, 50) + '<span class="nm">' + X.tm(A.id) + '</span><span class="x">' + pre[0][0] + '-' + pre[0][1] + '</span></div><div class="sc">' + sa + '<span class="muted">–</span>' + sb + '</div><div class="side">' + X.logo(B, 50) + '<span class="nm">' + X.tm(B.id) + '</span><span class="x">' + pre[1][0] + '-' + pre[1][1] + '</span></div></div>' +
    (rec.sub && rec.sub.length ? '<p class="sm" style="text-align:center;margin:6px 0 0">' + rec.sub.map(function(s){ return esc(P(s.out).n) + " can't make it (scheduling) — " + esc(P(s.inn).n) + " subs in"; }).join("; ") + '</p>' : '') + '</div><div class="dlg-b"><div class="maps">';
  rec.maps.forEach(function(mp, i){
    if (live && i > cur) return;
    var done = mapDone(i), ev = mp.ev || [], shown = live && i === cur ? ev.slice(0, evN) : ev;
    var last = shown.filter(function(e){ return e.s; }).slice(-1)[0], liveSc = done ? mp.sc : last ? last.s : [0, 0];
    h += '<div class="mapc' + (live && i === cur && !done ? " now" : "") + '"><div class="mh"><span>Map ' + (i + 1) + ' · ' + DY.MODE_NAME[mp.mode] + ' · ' + esc(mp.map || "") + '</span><span class="s"><span class="' + (done && mp.aw ? "up" : "") + '">' + esc(A.abbr) + ' ' + liveSc[0] + '</span> – <span class="' + (done && !mp.aw ? "up" : "") + '">' + liveSc[1] + ' ' + esc(B.abbr) + '</span></span></div>';
    if (ev.length && (live || U.showPbp)) h += '<ol class="pbp">' + shown.map(function(e){ return '<li class="' + (e.hl ? "hl " : "") + (e.end ? "end " : "") + (e.w || "") + '">' + (e.s ? '<span class="num">' + (mp.mode === "HP" ? "H" : "R") + e.r + ' · ' + e.s[0] + '-' + e.s[1] + '</span>' : '<span class="num">' + (e.end ? "FINAL" : "★") + '</span>') + '<span>' + esc(e.t) + '</span></li>'; }).join("") + '</ol>';
    if (done && mp.la){
      var lines = function(L){ return '<table class="tb"><thead><tr><th></th><th class="n">K</th><th class="n">D</th><th class="n">+/-</th><th class="n">' + OBJH[mp.mode] + '</th><th class="n">WAR+</th></tr></thead><tbody>' + L.map(function(x){ var o = mp.mode === "HP" ? x[3] + "s" : mp.mode === "SND" ? x[3] + "/" + x[4] + "/" + x[5] : x[3]; return '<tr><td>' + X.pl(x[0]) + '</td><td class="n">' + x[1] + '</td><td class="n">' + x[2] + '</td><td class="n">' + X.delta(x[1] - x[2]) + '</td><td class="n">' + o + '</td><td class="n">' + f2(x[6]) + '</td></tr>'; }).join("") + '</tbody></table>'; };
      h += '<div class="grid2" style="margin-top:8px">' + lines(mp.la) + lines(mp.lb) + '</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  if (live && !over){
    var curDone = mapDone(cur);
    h += '<div class="row" style="justify-content:flex-end">' + (curDone ? X.btn("nextMap", "Next map", "primary") : X.btn("skipMap", "Skip to end of map", "ghost")) + X.btn("skipLive", "Sim rest of series", "ghost") + '</div>';
    return h + '</div>';
  }
  if (!live && rec.maps.some(function(mp){ return mp.ev && mp.ev.length; })) h += '<div class="row">' + X.btn("togglePbp", U.showPbp ? "Hide play-by-play" : "Show play-by-play", "ghost sm") + '</div>';
  if (rec.tot){
    var rows = function(ids){ return ids.map(function(id){ var t = rec.tot[id]; if (!t) return ""; return '<tr><td>' + X.pl(id) + '</td><td class="n">' + t.m + '</td><td class="n">' + t.k + '</td><td class="n">' + t.d + '</td><td class="n"><b>' + f2(kd(t.k, t.d)) + '</b></td><td class="n">' + f2(t.war) + '</td></tr>'; }).join(""); };
    h += '<div class="grid2"><div><div class="label" style="margin-bottom:4px">' + esc(A.name) + ' series</div>' + X.table(["", {h:"Maps", n:1}, {h:"K", n:1}, {h:"D", n:1}, {h:"K/D", n:1}, {h:"WAR+", n:1}], [rows(rec.ia)]) + '</div><div><div class="label" style="margin-bottom:4px">' + esc(B.name) + ' series</div>' + X.table(["", {h:"Maps", n:1}, {h:"K", n:1}, {h:"D", n:1}, {h:"K/D", n:1}, {h:"WAR+", n:1}], [rows(rec.ib)]) + '</div></div>';
  }
  return h + '<div class="row" style="justify-content:flex-end">' + X.btn("close", "Continue", "primary") + '</div></div>';
};
X.startLive = function(){
  var ms = {slow:1100, normal:650, fast:280}[U.speed || "normal"];
  if (U.liveT) clearInterval(U.liveT);
  U.liveT = setInterval(function(){
    var m = U.modal; if (!m || m.kind !== "box" || !m.live){ clearInterval(U.liveT); U.liveT = null; return; }
    var mp = m.arg.maps[m.cur], ev = mp && mp.ev || [];
    if (m.evN < ev.length){ m.evN++; m.keep = true; X.renderModal(); var el = document.querySelector(".dy-modal .mapc.now .pbp li:last-child"); if (el && el.scrollIntoView) el.scrollIntoView({block:"nearest"}); }
    if (m.evN >= ev.length){ clearInterval(U.liveT); U.liveT = null; m.keep = true; X.renderModal(); }
  }, ms);
};

/* =====================================================================================
   12-TEAM BRACKET
   ===================================================================================== */
var SRC = {W1:["Seed 1", "Seed 8"], W2:["Seed 4", "Seed 5"], W3:["Seed 2", "Seed 7"], W4:["Seed 3", "Seed 6"], L1:["Loser W1", "Seed 12"], L2:["Loser W2", "Seed 11"], L3:["Loser W3", "Seed 10"], L4:["Loser W4", "Seed 9"], W5:["Winner W1", "Winner W2"], W6:["Winner W3", "Winner W4"], L5:["Winner L1", "Winner L2"], L6:["Winner L3", "Winner L4"], L7:["Winner L5", "Loser W6"], L8:["Winner L6", "Loser W5"], W7:["Winner W5", "Winner W6"], L9:["Winner L7", "Winner L8"], L10:["Winner L9", "Loser W7"], GF:["Winner W7", "Winner L10"], GF2:["Winner L10", "Winner W7"]};
X.bracket = function(){
  var g = G(), po = g.po; if (!po) return "";
  var cur = DY.poNext();
  var team = function(id){ return id == null ? null : T(id); };
  var match = function(id){
    var M = DY.PO[id], r = po.res[id], a = r ? r.a : DY.poRef(M.a), b = r ? r.b : DY.poRef(M.b);
    var row = function(tid, sc, won, src){ var t = team(tid); if (!t) return '<div class="bt tbd"><span class="bs"></span><span class="bn">' + src + '</span><span class="bc"></span></div>'; return '<div class="bt' + (r ? (won ? " w" : " l") : "") + (t.user ? " me" : "") + '"><span class="bs">' + (po.pseeds[tid] || "") + '</span><span class="bn">' + esc(t.name) + '</span><span class="bc">' + (r ? sc : "") + '</span></div>'; };
    var mine = (a === g.user || b === g.user);
    return '<div class="bm' + (r ? "" : " pend") + (mine ? " mine" : "") + (cur === id ? " cur" : "") + '"' + (r && r.maps && r.maps[0] && r.maps[0].la ? ' data-a="pobox" data-arg="' + id + '" style="cursor:pointer"' : '') + '><div class="bid">' + id + '</div>' + row(a, r ? r.wa : 0, r && r.wa > r.wb, SRC[id][0]) + row(b, r ? r.wb : 0, r && r.wb > r.wa, SRC[id][1]) + '</div>';
  };
  var hasReset = !!po.res.GF2 || DY.poOrder().length === DY.PO_ORDER.length;
  var sec = function(cols, titles, cls){ return '<div class="bsec ' + cls + '">' + cols.map(function(c, i){ return '<div class="bcol"><div class="btitle">' + titles[i] + '</div><div class="bmatches">' + c.map(match).join("") + '</div></div>'; }).join("") + '</div>'; };
  return '<div class="bk"><div class="bhead">Winners bracket · pool winners and runners-up</div>' + sec([["W1", "W2", "W3", "W4"], ["W5", "W6"], ["W7"], hasReset ? ["GF", "GF2"] : ["GF"]], ["Winners R1", "Winners semis", "Winners final", "Grand final" + (hasReset ? " + reset" : "")], "win") +
    '<div class="bhead">Elimination bracket · third-place teams wait for the Winners R1 losers</div>' + sec([["L1", "L2", "L3", "L4"], ["L5", "L6"], ["L7", "L8"], ["L9"], ["L10"]], ["Elim R1", "Elim R2", "Elim R3", "Elim quarterfinal", "Elim final"], "los") + '</div>';
};
})();
