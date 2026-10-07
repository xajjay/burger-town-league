/* DYNASTY UI: setup, fantasy draft, the hub (tabs), actions, autosave. */
(function(){
"use strict";
var DY = window.DY, X = window.DYU, DATA = window.DYN_DATA;
var G = function(){ return DY.G; };
var esc = X.esc, P = X.P, T = X.T, f2 = X.f2, f1 = X.f1, f0 = X.f0, money = X.money, kd = X.kd, btn = X.btn, panel = X.panel, table = X.table, kv = X.kv;
var root = document.getElementById("gm-body"); root.classList.add("dy");
var mhost = document.createElement("div"); mhost.id = "dy-modal-host"; root.closest(".gm").appendChild(mhost);
var U = X.U;
Object.assign(U, {tab:"home", slot:1, pf:{view:"all", role:"ALL", q:"", sort:"ovr", n:60}, tr:{tid:null, mine:[], theirs:[], cash:0, ev:null}, dr:{role:"ALL", q:"", sort:"ovr"}, fa:{view:"all", role:"ALL", sort:"rank"}, news:"all", hist:"seasons", lg:"stand", lead:"war", lineSel:null, prog:"mine", fb:{}, speed:"normal", sched:"mine"});
try { U.speed = localStorage.getItem("btlg-dyn-speed") || "normal"; } catch (e){}

/* ---------------- save ---------------- */
var saveT = null, saving = false;
function save(){ if (!G()) return; clearTimeout(saveT); saveT = setTimeout(function(){ if (saving){ save(); return; } saving = true; DY.saveSlot(U.slot).then(function(err){ saving = false; if (err) X.toast(esc(err), 5000); }); }, 350); }

/* ---------------- render ---------------- */
function render(){
  try { inner(); }
  catch (e){ console.error(e); root.innerHTML = panel("Something went wrong", '<p class="status">This dynasty hit an error. Export your save so nothing is lost, then reload the page.</p><pre class="sm" style="white-space:pre-wrap">' + esc(e && e.stack || e) + '</pre><div class="gm-actions">' + btn("export", "Export save", "primary") + btn("toSetup", "Back to start", "ghost") + '</div>'); }
}
function inner(){
  if (!G()) return renderSetup();
  if (G().phase === "draft") return renderDraft();
  renderHub();
}
function after(){ render(); X.renderModal(); save(); }

/* =====================================================================================
   SETUP
   ===================================================================================== */
function renderSetup(){
  var meta = DY.readMeta(), free = [1, 2, 3].find(function(n){ return !meta[n]; }) || 1;
  var slots = [1, 2, 3].map(function(n){ var m = meta[n]; return '<div class="card' + (m ? "" : "") + '"><div class="label">Slot ' + n + '</div>' + (m ? '<div class="big" style="margin:4px 0">' + esc(m.team) + '</div><div class="sm">Season ' + m.season + ' · ' + esc(m.phase) + ' · ' + esc(m.rec) + (m.titles ? ' · 🏆×' + m.titles : '') + '</div><div class="sm">Saved ' + new Date(m.at).toLocaleString() + '</div><div class="row" style="margin-top:8px">' + btn("load", "Continue", "primary sm", n) + btn("delSlot", "Delete", "ghost sm", n) + '</div>' : '<div class="muted" style="margin:6px 0">Empty</div>') + '</div>'; }).join("");
  root.innerHTML =
    panel("Start a dynasty", '<div class="row" style="align-items:flex-end"><label class="fld">City<input type="text" id="su-city" maxlength="22" placeholder="e.g. Knoxville" autocomplete="off"></label><label class="fld">Team name<input type="text" id="su-nick" maxlength="20" placeholder="e.g. Smokies" autocomplete="off"></label><label class="fld" style="flex:0 1 110px">Abbreviation<input type="text" id="su-abbr" maxlength="4" placeholder="KNX" autocomplete="off"></label><label class="fld" style="flex:0 1 130px">Team color<select id="su-col">' + [["#f27f0c","Orange"],["#e01e37","Red"],["#1d4ed8","Blue"],["#2e8b3a","Green"],["#6b2fb3","Purple"],["#d4a017","Gold"],["#0e9aa7","Teal"],["#e75aa6","Pink"],["#7a0e1a","Maroon"],["#c0c6cc","Silver"],["#222222","Black"]].map(function(c){ return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select></label><label class="fld" style="flex:0 1 120px">Save slot<select id="su-slot">' + [1, 2, 3].map(function(n){ return '<option value="' + n + '"' + (n === free ? " selected" : "") + '>Slot ' + n + (meta[n] ? " (overwrite)" : "") + '</option>'; }).join("") + '</select></label>' + btn("newGame", "Go to the draft", "primary") + '</div><p class="sm" id="su-region" style="margin:10px 0 0">Real US cities go in the pool that fits them best. Anything else gets a random pool.</p>') +
    panel("Your dynasties", '<div class="grid3">' + slots + '</div><div class="row" style="margin-top:12px"><label class="gbtn ghost sm" style="cursor:pointer">Import a save file<input type="file" id="imp" accept=".json,application/json" hidden></label><span class="sm">Saves live in this browser. Export a file from the hub to back one up or move it to another device.</span></div>') +
    panel("How Dynasty works", '<div class="grid2 sm" style="color:var(--paper-dim)"><div><p><b>Season one is a blank slate.</b> Every real BTL player starts with a profile built from his real career: lifetime overall, mode K/Ds, and Season 5–6 objective data (hill time, plants, defuses, first bloods, Control objective kills). Real history and trophies do not carry over.</p><p><b>16 teams, 4 pools.</b> Each team plays its 3 pool rivals plus 7 cross-pool opponents: 5 weeks, 2 matches a week. Top 2 in each pool reach the winners bracket, 3rd starts in the elimination bracket, 4th goes home. 12-team double elimination, best of 5, bracket reset in the grand final.</p><p><b>Academy league.</b> Everyone not on a main roster plays in the Academy. Subs play there too. Big Academy seasons earn call-ups.</p></div><div><p><b>Money.</b> Budgets start equal and then follow fan engagement and winning, with 40% of revenue shared across the league and a $1.35M salary cap. Salaries run from the $50k minimum to $1M. Contracts run 1–4 seasons, with an optional team or player option year (4 seasons max). Draft picks sign 2-season rookie deals with a team option, then become restricted free agents their team can match.</p><p><b>Players are people.</b> They have priorities (money, winning, loyalty, playing time), relationships with their teams, and they react to losing. They progress and regress. Rookies can be generational, hidden gems or busts, and their true overalls stay hidden until they sign and a new season starts.</p><p><b>Offseason.</b> Options first, then three weeks of free agency where you and 15 CPU teams bid. Legacy scores, a Hall of Fame and full history track everything.</p></div></div>');
  var c = root.querySelector("#su-city"), r = root.querySelector("#su-region");
  c.oninput = function(){ var reg = DY.regionFor(c.value); r.innerHTML = c.value.trim() ? (reg ? esc(c.value.trim()) + " → <b>" + DY.POOL_NAME[reg] + " pool</b>" : esc(c.value.trim()) + " isn't on the map, so you'll get a random pool.") : "Real US cities go in the pool that fits them best. Anything else gets a random pool."; };
  root.querySelector("#imp").onchange = function(e){ var f = e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function(){ try { DY.importText(rd.result, DATA); U.slot = +root.querySelector("#su-slot").value; U.tab = "home"; after(); X.toast("Save imported into slot " + U.slot + "."); } catch (err){ X.toast(esc(err.message), 4000); } }; rd.readAsText(f); };
  c.focus();
}

/* =====================================================================================
   FANTASY DRAFT
   ===================================================================================== */
function renderDraft(){
  var g = G(), n = g.draft.n, total = DY.draftTotal();
  if (n >= total){ DY.finishDraft(); U.tab = "home"; save(); return renderHub(); }
  var u = DY.userT(), rd = Math.floor(n / DY.NT) + 1, f = U.dr;
  var mySlot = g.draft.order.indexOf(u.id) + 1;
  var pool = DY.draftPool();
  if (f.role !== "ALL") pool = pool.filter(function(p){ return p.role === f.role; });
  if (f.q){ var q = f.q.toLowerCase(); pool = pool.filter(function(p){ return p.n.toLowerCase().indexOf(q) >= 0; }); }
  var key = {ovr:function(p){ return -p.ovr; }, pot:function(p){ return DY.gradeRank(p.potG) * 10 - p.ovr / 10; }, gun:function(p){ return -p.at.gun; }, hp:function(p){ return -p.at.hp; }, snd:function(p){ return -p.at.snd; }, ctl:function(p){ return -p.at.ctl; }, obj:function(p){ return -p.at.obj; }}[f.sort];
  pool.sort(function(a, b){ return key(a) - key(b); });
  var nd = u.roster.length ? DY.teamNeeds(u.id, false) : null;
  var rows = pool.slice(0, 140).map(function(p){ var ok = DY.canDraft(u.id, p); return '<tr><td>' + X.pl(p.id) + (nd ? ' ' + X.fitChips(p, nd) : '') + '</td><td>' + X.role(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="n">' + X.pot(p) + '</td><td>' + DY.stage(p) + '</td>' + DY.ATTR.map(function(k){ return '<td class="n">' + f0(p.at[k]) + '</td>'; }).join("") + '<td class="sm">' + esc(p.persona) + '</td><td class="n">' + money(DY.salaryFor(p.ovr)) + '</td><td>' + btn("draftPick", "Draft", ok ? "primary sm" : "ghost sm", p.id, !ok, ok ? "" : "You need room for 2 ARs and 2 SMGs") + '</td></tr>'; });
  var mine = u.roster.map(P);
  var box = '<div class="lineup">' + [0, 1, 2, 3, 4].map(function(i){ var p = mine[i]; return p ? '<div class="lslot">' + X.role(p) + '<b>' + esc(p.n) + '</b><span class="num">' + Math.round(p.ovr) + ' · ' + p.potG + '</span></div>' : '<div class="lslot ' + (i === 4 ? "sub" : "") + '" style="opacity:.55"><span class="lab">' + (i < 4 ? "Starter" : "Sub") + '</span><b>—</b></div>'; }).join("") + '</div>';
  var log = g.draft.picks.slice(-10).reverse().map(function(x){ var p = P(x.p), t = T(x.t); return '<li><span class="num muted">#' + (x.n + 1) + '</span> ' + esc(t.abbr) + (t.user ? " ★" : "") + ' — ' + X.pl(p.id) + ' ' + X.role(p) + ' <span class="num">' + Math.round(p.ovr) + '</span></li>'; }).join("");
  root.innerHTML = panel("Fantasy draft · Round " + rd + " of " + DY.ROSTER + " · Pick " + (n + 1) + " of " + total, '<div class="row between"><div><div class="big" style="color:var(--mustard)">You\'re on the clock — ' + esc(u.name) + '</div><div class="sm">Draft slot #' + mySlot + ' of 16 (snake). Build 2 ARs + 2 SMGs + a sub. Every pick signs a 1 + 1 (team option) deal priced by value.</div></div><div class="row">' + btn("draftAuto", "Auto-pick best fit", "ghost sm") + btn("draftAutoAll", "Auto-draft the rest", "ghost sm") + '</div></div><div style="margin-top:12px">' + box + '</div><div class="label" style="margin:14px 0 6px">Your team so far vs the league</div>' + X.needsPanel(u.id, false)) +
    panel("", '<div class="filters"><div class="gm-modes">' + ["ALL", "AR", "SMG"].map(function(r){ return '<button class="chip" data-a="drRole" data-arg="' + r + '" aria-pressed="' + (f.role === r) + '">' + r + '</button>'; }).join("") + '</div><select id="dr-sort">' + [["ovr", "Overall"], ["pot", "Potential"], ["gun", "Slaying"], ["hp", "Hardpoint"], ["snd", "Search & Destroy"], ["ctl", "Control"], ["obj", "Objective"]].map(function(o){ return '<option value="' + o[0] + '"' + (f.sort === o[0] ? " selected" : "") + '>Sort: ' + o[1] + '</option>'; }).join("") + '</select><input type="search" id="dr-q" placeholder="Search players" value="' + esc(f.q) + '" style="flex:1 1 160px"></div>' +
      table(["Player", "Pos", {h:"OVR", n:1}, {h:"POT", n:1}, "Stage", {h:"SLAY", n:1}, {h:"HP", n:1}, {h:"SND", n:1}, {h:"CTL", n:1}, {h:"OBJ", n:1}, "Personality", {h:"Value", n:1, t:"Auto-contract salary at this overall"}, ""], rows, "tall")) +
    '<details class="panel"><summary class="label" style="cursor:pointer">Latest picks</summary><ul class="logl">' + log + '</ul></details>';
  root.querySelector("#dr-sort").onchange = function(e){ U.dr.sort = e.target.value; render(); };
  var qi = root.querySelector("#dr-q"); qi.oninput = function(){ U.dr.q = qi.value; var pos = qi.selectionStart; render(); var q2 = root.querySelector("#dr-q"); q2.focus(); q2.setSelectionRange(pos, pos); };
}

/* =====================================================================================
   HUB
   ===================================================================================== */
var TABS = [["home", "Home"], ["team", "My Team"], ["schedule", "Schedule"], ["players", "Players"], ["trades", "Trades"], ["contracts", "Contracts"], ["draft", "Draft"], ["league", "League"], ["news", "News"], ["history", "History"]];
function renderHub(){
  var g = G(), u = DY.userT(), ps = DY.poolStandings(u.pool), place = ps.indexOf(u) + 1;
  var space = DY.space(u), fm = DY.fanMetrics(u);
  var h = '<div class="panel"><div class="hub-head"><div class="hub-title">' + X.logo(u, 54) + '<div><div class="big">' + esc(u.name) + '</div><div class="hub-meta"><span>' + esc(DY.seasonLabel()) + '</span><span>' + DY.POOL_NAME[u.pool] + ' pool' + (g.phase === "season" || g.phase === "playoffs" ? ' · <b>' + u.w + '-' + u.l + '</b> (' + ordinal(place) + ')' : '') + '</span><span>' + X.tagChip(u.tag) + '</span>' + (u.titles ? '<span>🏆 ×' + u.titles + '</span>' : '') + '</div></div></div><div class="gm-actions">' + primaryActions() + '</div></div>' +
    '<div class="money-strip"><span class="pill">Budget <b>' + money(u.budget + (u.cashAdj || 0)) + '</b></span>' + (DY.SALARY_CAP ? '<span class="pill" title="No team can spend more than the cap, however big its budget">Cap <b>' + money(DY.SALARY_CAP) + '</b></span>' : '') + '<span class="pill">Payroll <b>' + money(DY.payroll(u)) + '</b></span><span class="pill ' + (space < 0 ? "bad" : space < 60 ? "warn" : "good") + '">Space <b>' + money(space) + '</b></span>' + (g.phase === "offseason" && g.off.stage === "fa" ? '<span class="pill">Pending offers <b>' + money(DY.committed(u)) + '</b></span>' : '') + '<span class="pill">Fans <b>' + fm.eng + '</b>/100</span><span class="pill">Roster <b>' + u.roster.length + '</b>/5</span></div></div>';
  h += alerts();
  h += '<div class="tabs" role="tablist">' + TABS.map(function(t){ var lab = t[0] === "contracts" && g.phase === "offseason" ? "Free Agency" : t[1], dot = (t[0] === "trades" && g.offers.length) || (t[0] === "contracts" && g.phase === "offseason" && g.off.stage !== "recap"); return '<button role="tab" data-a="tab" data-arg="' + t[0] + '" aria-selected="' + (U.tab === t[0]) + '">' + lab + (dot ? '<span class="dot"></span>' : '') + '</button>'; }).join("") + '</div>';
  var tabs = {home:tabHome, team:tabTeam, schedule:tabSchedule, players:tabPlayers, trades:tabTrades, contracts:tabContracts, draft:tabDraft, league:tabLeague, news:tabNews, history:tabHistory};
  h += '<div class="stack">' + (tabs[U.tab] || tabHome)() + '</div>';
  h += '<div class="row" style="justify-content:space-between;margin-top:6px"><div class="row">' + btn("export", "Export save", "ghost sm") + btn("toSetup", "Switch dynasty", "ghost sm") + btn("autoToggle", "Auto manager: " + (G().settings.auto ? "ON" : "OFF"), G().settings.auto ? "primary sm" : "ghost sm") + '</div><div class="spdrow"><span class="lab">Match reveal</span>' + ["slow", "normal", "fast"].map(function(k){ return '<button class="chip" data-a="speed" data-arg="' + k + '" aria-pressed="' + (U.speed === k) + '">' + k[0].toUpperCase() + k.slice(1) + '</button>'; }).join("") + '</div></div>';
  root.innerHTML = h;
  bindHub();
}
function ordinal(n){ return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); }
function primaryActions(){
  var g = G(), u = DY.userT();
  if (g.phase === "preseason") return btn("startSeason", "Start Season " + g.season, "primary");
  if (g.phase === "season"){
    var pr = DY.userMatch(), opp = pr ? T(pr[0] === u.id ? pr[1] : pr[0]) : null;
    return btn("playNext", "Play W" + g.week + " M" + (g.round % 2 + 1) + (opp ? " vs " + esc(opp.abbr) : ""), "primary") + btn("simWeek", "Sim week", "ghost") + btn("simReg", "Sim to playoffs", "ghost");
  }
  if (g.phase === "playoffs"){
    var id = DY.poNext(); if (!id) return "";
    var M = DY.PO[id], a = DY.poRef(M.a), b = DY.poRef(M.b), mine = a === u.id || b === u.id;
    if (mine) return btn("playPO", "Play " + esc(M.r) + " vs " + esc(T(a === u.id ? b : a).abbr), "primary") + btn("simPOAll", "Sim the rest", "ghost");
    return btn(DY.userAlive() ? "simPOUser" : "simPOAll", DY.userAlive() ? "Sim to my next series" : "Sim the rest of the playoffs", "primary") + btn("playPOOne", "Next series", "ghost");
  }
  if (g.phase === "offseason"){
    var st = g.off.stage;
    if (st === "recap") return btn("toOptions", "Continue: progression & options", "primary");
    if (st === "options") return btn("toDraft", "Start the rookie draft", "primary");
    if (st === "draft"){ var oc = DY.draftAdvance(); return oc === u.id ? btn("tab", "You're on the clock", "primary", "draft") + btn("rdAuto", "Auto-pick", "ghost") : btn("tab", "Draft board", "primary", "draft"); }
    if (st === "signing") return btn("tab", "Rookie signings", "ghost", "draft") + btn("openFA", "Close signings → free agency", "primary");
    if (st === "signed") return btn("openFA", "Open free agency", "primary");
    return btn("endFAWeek", g.off.rfaHold ? "Done with offer sheets → Season " + (g.season + 1) : g.off.week < 3 ? "End free agency week " + g.off.week : "Finish free agency → Season " + (g.season + 1), "primary");
  }
  return "";
}
function alerts(){
  var g = G(), u = DY.userT(), a = [];
  if (g.offers.length) a.push(['<b>' + g.offers.length + ' trade offer' + (g.offers.length > 1 ? "s" : "") + '</b> waiting.', btn("tab", "View", "ghost sm", "trades")]);
  u.roster.forEach(function(id){ var p = P(id); if (p.trq) a.push(['<b>' + esc(p.n) + '</b> has requested a trade. His mood is hurting his play.', btn("player", "View", "ghost sm", id)]); });
  if (g.phase !== "draft" && g.phase !== "offseason" && !DY.validRoster(u.roster)) a.push(["Your roster needs at least 2 ARs and 2 SMGs (4–5 players).", btn("tab", "My Team", "ghost sm", "team")]);
  if (g.phase !== "offseason" && DY.space(u) < 0) a.push([g.phase === "preseason" ? "You're " + money(-DY.space(u)) + " over budget. Start the season like this and half the overage comes off next season's budget (luxury tax)." : "You're over budget. Release or trade salary.", btn("tab", "My Team", "ghost sm", "team")]);
  if (g.phase === "offseason" && g.off.stage === "draft" && DY.draftAdvance() === u.id) a.push(["<b>You're on the clock</b> in the rookie draft.", btn("tab", "Draft board", "ghost sm", "draft")]);
  if (g.phase === "offseason" && g.off.stage === "signing" && DY.userRights().some(function(p){ return !p.draftRights.agreed; })) a.push(["Negotiate with your draft pick" + (DY.userRights().length > 1 ? "s" : "") + ": " + DY.userRights().map(function(p){ return esc(p.n); }).join(", ") + ". Unsigned picks become free agents.", btn("tab", "Signings", "ghost sm", "draft")]);
  if ((g.phase === "season" || g.phase === "preseason") && (u.sp || 0) >= 8 && DY.prospects().length) a.push(["You have <b>" + u.sp + " scouting points</b> to spend on the next rookie class.", btn("tab", "Scouting", "ghost sm", "draft")]);
  if (g.phase === "season" && g.week >= 3){ var el = u.roster.filter(function(id){ return DY.extEligible(P(id)) && !g.ext[id]; }); if (el.length) a.push([el.length + ' player' + (el.length > 1 ? "s are" : " is") + ' eligible for an extension.', btn("tab", "Contracts", "ghost sm", "contracts")]); }
  Object.keys(g.ext).forEach(function(id){ var x = g.ext[id]; if (x.tid === u.id && x.status === "signed" && !x.seen){ x.seen = 1; a.push(['<b>' + esc(P(id).n) + '</b> agreed to an extension.', ""]); } if (x.tid === u.id && x.status === "broken" && !x.seen){ x.seen = 1; a.push(['<b>' + esc(P(id).n) + '</b> broke off extension talks. He\'ll test free agency.', ""]); } });
  if (g.phase === "offseason" && g.off.stage === "options"){ var po = DY.pendingUserOptions(); if (po.length) a.push(["Decide " + po.length + " team option" + (po.length > 1 ? "s" : "") + " before free agency opens.", btn("tab", "Free Agency", "ghost sm", "contracts")]); }
  if (g.phase === "offseason" && g.off.stage === "fa" && DY.rfaPending().length) a.push(["<b>Offer sheet" + (DY.rfaPending().length > 1 ? "s" : "") + " to match:</b> " + DY.rfaPending().map(function(id){ return esc(P(id).n); }).join(", ") + ". Match or let him go.", btn("tab", "Free Agency", "ghost sm", "contracts")]);
  if (g.phase === "offseason" && g.off.stage === "fa" && u.roster.length < 5) a.push([(5 - u.roster.length) + " open roster spot" + (u.roster.length < 4 ? "s" : "") + ". Unfilled spots are auto-filled at the minimum after week 3.", btn("tab", "Free Agency", "ghost sm", "contracts")]);
  if (!a.length) return "";
  return '<div class="alerts">' + a.map(function(x){ return '<div class="alert"><span>' + x[0] + '</span>' + x[1] + '</div>'; }).join("") + '</div>';
}

/* ---------------- HOME ---------------- */
function tabHome(){
  var g = G(), u = DY.userT(), h = "";
  if (g.phase === "offseason") h += offseasonPanel();
  else if (g.phase === "preseason") h += panel("Season " + g.season + " preseason", '<div class="grid2"><div>' + powerTable(g.pr.slice(0, 16), true) + '</div><div class="stack"><div class="card"><h3>Your starting four</h3>' + lineupMini(u) + '<div class="row" style="margin-top:10px">' + btn("tab", "Edit lineup", "ghost sm", "team") + btn("startSeason", "Start the season", "primary sm") + '</div></div><div class="card"><h3>Team strategy</h3><p class="sm" style="margin:0 0 8px">CPU teams read your tag when they pitch trades.</p>' + tagPicker() + '</div><div class="card"><h3>Scouting budget</h3>' + scoutPicker() + '</div></div></div>') + campPanel();
  else if (g.phase === "season") h += nextMatchPanel();
  else if (g.phase === "playoffs") h += panel("Playoffs · Season " + g.season, X.bracket());
  if (g.phase === "season" || g.phase === "preseason"){
    var pool = DY.poolStandings(u.pool);
    h += '<div class="grid2">' + panel(DY.POOL_NAME[u.pool] + " pool", poolTable(u.pool)) + panel("Headlines", newsList(g.news.slice(0, 5)) + '<div class="row" style="margin-top:8px">' + btn("tab", "All news", "ghost sm", "news") + '</div>') + '</div>';
  } else h += panel("Headlines", newsList(g.news.slice(0, 6)));
  if (g.phase === "season") h += aroundLeague();
  return h;
}
// the latest round: every match can be watched live (map by map) or opened as a box score
function aroundLeague(){
  var g = G(); if (g.phase !== "season" || g.round <= 0) return "";
  var rd = g.round - 1, lastR = g.res.filter(function(r){ return r.r === rd; });
  return panel("Around the league · Week " + (Math.floor(rd / 2) + 1) + " Match " + (rd % 2 + 1), table(["Match", {h:"Score", n:1}, "Maps", ""], lastR.map(function(r){ var i = g.res.indexOf(r), A = T(r.a), B = T(r.b), mine = A.user || B.user, det = r.maps[0] && r.maps[0].la;
    return '<tr class="' + (mine ? "me" : "") + '"><td style="white-space:nowrap">' + X.logo(A, 20) + ' ' + X.tm(r.a, 1) + ' vs ' + X.logo(B, 20) + ' ' + X.tm(r.b, 1) + '</td><td class="n"><b>' + r.wa + '-' + r.wb + '</b></td><td class="sm">' + (det ? r.maps.map(function(m){ return esc(m.map) + ' ' + (m.mode === "SND" ? "SnD" : m.mode); }).join(" · ") : "") + '</td><td style="white-space:nowrap">' + (det ? btn("watchRes", "Watch", "primary sm", i) + btn("boxRes", "Box", "ghost sm", i) : "") + '</td></tr>'; })) + '<p class="sm" style="margin:6px 0 0">Watch replays any match from this round map by map. Full box scores for other teams are kept until the next round is played.</p>');
}
function campPanel(){
  var g = G(), u = DY.userT(), used = g.camp || [];
  var done = used.map(function(c){ return '<li>' + X.pl(c.pid) + ' worked on <b>' + DY.CAMP[c.f] + '</b></li>'; }).join("");
  var avail = u.roster.filter(function(id){ return !used.some(function(c){ return c.pid === id; }); });
  return panel("Preseason camp · " + used.length + " of 2 used", '<p class="sm" style="margin:0 0 10px">Send two different players to camp, one focus each. A skill focus adds a few points to that skill. A potential focus raises his ceiling (about one grade, e.g. B to B+). Small, but it adds up.</p>' + (done ? '<ul class="logl" style="margin:0 0 10px">' + done + '</ul>' : '') + (used.length < 2 ? '<div class="row" style="align-items:flex-end"><label class="fld">Player<select id="camp-p">' + avail.map(function(id){ var p = P(id); return '<option value="' + id + '">' + esc(p.n) + ' (' + p.role + ', ' + (DY.hiddenOvr(p) ? "??" : Math.round(p.ovr)) + ', ' + p.potG + ')</option>'; }).join("") + '</select></label><label class="fld">Focus<select id="camp-f">' + Object.keys(DY.CAMP).map(function(k){ return '<option value="' + k + '">' + DY.CAMP[k] + '</option>'; }).join("") + '</select></label>' + btn("campGo", "Send to camp", "primary sm") + '</div>' : '<p class="sm" style="margin:0">Camp is done for this season.</p>'));
}
function lineupMini(t){ return '<ul class="logl" style="margin:0">' + t.lineup.map(function(id){ var p = P(id); return '<li>' + X.role(p) + ' ' + X.pl(id) + ' ' + X.ovr(p) + '</li>'; }).join("") + (DY.sub(t) != null ? '<li class="muted">Sub: ' + X.pl(DY.sub(t)) + '</li>' : '') + '</ul>'; }
function tagPicker(){ var u = DY.userT(); return '<div class="gm-modes">' + DY.TAGS.map(function(t){ return '<button class="chip" data-a="setTag" data-arg="' + t + '" aria-pressed="' + (u.tag === t) + '" title="' + esc(DY.TAG_TEXT[t]) + '">' + t + '</button>'; }).join("") + '</div><p class="sm" style="margin:6px 0 0">' + esc(DY.TAG_TEXT[u.tag]) + (u.suggest && u.suggest !== u.tag ? ' The league sees you as <b>' + u.suggest + '</b>.' : '') + '</p>'; }
function nextMatchPanel(){
  var g = G(), u = DY.userT(), pr = DY.userMatch(); if (!pr) return "";
  var opp = T(pr[0] === u.id ? pr[1] : pr[0]), rd = g.sched[g.round];
  var cmp = DY.MODES.map(function(m){ var a = DY.modeRating(u, m), b = DY.modeRating(opp, m), d = Math.max(1, Math.abs(a - b)); return '<div class="cmp"><span class="nv">' + f1(a) + '</span><div class="l"><i style="width:' + Math.min(100, Math.max(4, (a - 70) * 3.5)) + '%"></i></div><span class="m">' + m + '</span><div class="r"><i style="width:' + Math.min(100, Math.max(4, (b - 70) * 3.5)) + '%"></i></div><span class="nv">' + f1(b) + '</span></div>'; }).join("");
  var last = g.res.filter(function(r){ return r.a === u.id || r.b === u.id; }).slice(-1)[0];
  var lineup = function(t){ return t.lineup.map(function(id){ var p = P(id); return '<div class="row" style="gap:6px;justify-content:center">' + X.role(p) + X.pl(id) + X.ovr(p) + '</div>'; }).join(""); };
  return panel("Week " + g.week + " · Match " + (g.round % 2 + 1) + (rd.pool ? " · Pool game" : " · Cross-pool"), '<div class="vs"><div class="side">' + X.logo(u, 50) + '<span class="nm">' + esc(u.name) + '</span><span class="x">' + u.w + '-' + u.l + ' · OVR ' + f1(DY.teamRating(u)) + '</span></div><div class="x">VS</div><div class="side">' + X.logo(opp, 50) + '<span class="nm">' + X.tm(opp.id) + '</span><span class="x">' + opp.w + '-' + opp.l + ' · OVR ' + f1(DY.teamRating(opp)) + ' · ' + X.tagChip(opp.tag) + '</span></div></div><div style="max-width:520px;margin:12px auto 0">' + cmp + '</div><div class="grid2" style="margin-top:12px"><div class="card"><div class="label" style="text-align:center;margin-bottom:6px">Your lineup</div>' + lineup(u) + '</div><div class="card"><div class="label" style="text-align:center;margin-bottom:6px">Their lineup</div>' + lineup(opp) + '</div></div>' + (last ? '<div class="row" style="margin-top:10px;justify-content:center"><span class="sm">Last match: ' + (((last.a === u.id) === (last.wa > last.wb)) ? '<b class="up">W</b>' : '<b class="dn">L</b>') + ' ' + Math.max(last.wa, last.wb) + '-' + Math.min(last.wa, last.wb) + ' vs ' + esc(T(last.a === u.id ? last.b : last.a).abbr) + '</span>' + btn("boxRes", "Box score", "ghost sm", g.res.indexOf(last)) + '</div>' : ''));
}
function poolTable(pool){
  var g = G(), ps = DY.poolStandings(pool), done = g.phase !== "season" && g.phase !== "preseason" || g.round >= DY.ROUNDS;
  return table([{h:"#", n:1}, "Team", {h:"W-L", n:1}, {h:"Maps", n:1}, {h:"Diff", n:1}, "Tag"], ps.map(function(t, i){ return '<tr class="' + (t.user ? "me " : "") + (i === 1 ? "cut" : "") + '"><td class="n">' + (i + 1) + '</td><td>' + X.tm(t.id) + '</td><td class="n"><b>' + t.w + '-' + t.l + '</b></td><td class="n">' + t.mw + '-' + t.ml + '</td><td class="n">' + X.delta(t.mw - t.ml) + '</td><td>' + X.tagChip(t.tag) + '</td></tr>'; })) + '<div class="sm" style="margin-top:6px">Top 2 → winners bracket · 3rd → elimination bracket · 4th → out</div>';
}
function powerTable(ids, pre){ var g = G(); return table([{h:"#", n:1}, "Team", "Pool", {h:"OVR", n:1}, pre ? "Tag" : "Record"], ids.map(function(id, i){ var t = T(id); return '<tr class="' + (t.user ? "me" : "") + '"><td class="n">' + (i + 1) + '</td><td>' + X.tm(id) + '</td><td>' + DY.POOL_NAME[t.pool] + '</td><td class="n">' + f1(DY.teamRating(t)) + '</td><td>' + (pre ? X.tagChip(t.tag) : t.w + '-' + t.l) + '</td></tr>'; })); }
function newsList(items){
  if (!items.length) return '<p class="empty">No news yet.</p>';
  return '<div class="news">' + items.map(function(n){ return '<div class="ni ' + n.type + '"><div class="nh"><span class="nt">' + esc(n.title) + '</span>' + X.when(n) + '</div><p>' + linkify(n.body) + '</p>' + (n.pr && n.type === "power" ? '<details style="margin-top:6px"><summary class="sm" style="cursor:pointer">Full rankings</summary>' + table([{h:"#", n:1}, "Team", {h:"Rec", n:1}, {h:"Move", n:1}], n.pr.map(function(r){ return '<tr class="' + (T(r.id).user ? "me" : "") + '"><td class="n">' + r.rk + '</td><td>' + X.tm(r.id) + '</td><td class="n">' + r.rec + '</td><td class="n">' + (r.mv ? X.delta(r.mv) : "–") + '</td></tr>'; })) + '</details>' : '') + '</div>'; }).join("") + '</div>';
}
// turn player and team names in news text into links
var linkRe = null, linkMap = null, linkSeason = -1, linkCount = -1;
function linkify(text){
  var g = G(), cnt = Object.keys(g.P).length;
  if (!linkRe || linkSeason !== g.season || linkCount !== cnt){
    linkMap = {}; var names = [];
    g.teams.forEach(function(t){ linkMap[t.name] = ["team", t.id]; names.push(t.name); });
    DY.allP().forEach(function(p){ if (p.n.length >= 3 && !linkMap[p.n] && ["MVP","ROY","MIP","HOF","Week","Season","The"].indexOf(p.n) < 0){ linkMap[p.n] = ["player", p.id]; names.push(p.n); } });
    names.sort(function(a, b){ return b.length - a.length; });
    linkRe = new RegExp("(^|[^A-Za-z0-9_])(" + names.map(function(n){ return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")(?![A-Za-z0-9_])", "g");
    linkSeason = g.season; linkCount = cnt;
  }
  return esc(text).replace(linkRe, function(m, pre, name){ var raw = name.replace(/&amp;/g, "&"), l = linkMap[raw] || linkMap[name]; if (!l) return m; return pre + '<a class="' + (l[0] === "team" ? "tm" : "pl") + '" data-a="' + l[0] + '" data-arg="' + l[1] + '">' + name + '</a>'; });
}

/* ---------------- OFFSEASON PANEL ---------------- */
function offseasonPanel(){
  var g = G(), o = g.off, u = DY.userT(), last = g.hist[g.hist.length - 1];
  if (o.stage === "recap"){
    var A = last.aw, me = last.stand.find(function(s){ return s.id === u.id; });
    var aw = [["League MVP", A.mvp], ["Finals MVP", A.fmvp], ["Rookie of the Year", A.roy], ["Most Improved", A.mip], ["Academy MVP", A.amvp], ["Super Burger", A.sb]].map(function(x){ return '<div class="card"><div class="alab">' + x[0] + '</div><div class="big">' + (x[1] != null ? X.pl(x[1]) : "—") + '</div><div class="sm">' + (x[1] != null && P(x[1]).team != null ? esc(T(P(x[1]).team).name) : "") + '</div></div>'; }).join("");
    var ret = o.retired.map(function(id){ var p = P(id); return '<li>' + X.pl(id) + ' <span class="sm">' + p.yrs + ' seasons · legacy ' + f1(p.legacy) + (g.hof.indexOf(id) >= 0 ? ' · <b style="color:var(--mustard)">Hall of Fame</b>' : '') + '</span></li>'; }).join("");
    return panel("Season " + g.season + " is in the books", '<div class="row between"><div><div class="label">Champions</div><div class="big" style="font-size:30px">🏆 ' + X.tm(last.champ) + '</div><div class="sm">Beat ' + X.tm(last.ru) + ' ' + Math.max(last.gf.wa, last.gf.wb) + '-' + Math.min(last.gf.wa, last.gf.wb) + (last.gf.reset ? ' in the bracket reset' : ' in the grand final') + (last.acad ? ' · Academy champions: ' + esc(last.acad.champ) : '') + '</div></div><div class="card"><div class="label">Your season</div><div class="big">' + me.w + '-' + me.l + ' · ' + X.finTxt(me.fin) + '</div><div class="sm">Budget next season: ' + money(u.budgetPrev || u.budget) + ' → <b>' + money(u.budget) + '</b> · fans ' + Math.round(u.fan.eng) + '</div></div></div>' +
      '<div class="grid3" style="margin-top:12px">' + aw + '</div><div class="grid2" style="margin-top:12px"><div class="card"><h3>All-Star 1st team</h3><ul class="logl" style="margin:0">' + A.as1.map(function(id){ return '<li>' + X.role(P(id)) + ' ' + X.pl(id) + '</li>'; }).join("") + '</ul><h3 style="margin-top:10px">All-Star 2nd team</h3><ul class="logl" style="margin:0">' + A.as2.map(function(id){ return '<li>' + X.role(P(id)) + ' ' + X.pl(id) + '</li>'; }).join("") + '</ul></div><div class="card"><h3>Retirements (' + o.retired.length + ')</h3>' + (ret ? '<ul class="logl" style="margin:0">' + ret + '</ul>' : '<p class="empty">Nobody retired this year.</p>') + (o.hof.length ? '<h3 style="margin-top:10px">Hall of Fame class</h3><p style="margin:0">' + o.hof.map(function(id){ return X.pl(id); }).join(", ") + '</p>' : '') + '</div></div>');
  }
  if (o.stage === "options") return panel("Offseason · progression & options", optionsBlock() + '<div class="card" style="margin-top:12px"><h3>Rookie draft</h3>' + myPicksHtml() + '<p class="sm" style="margin:6px 0 0">You have <b>' + DY.freeSpots(u) + '</b> open roster spot' + (DY.freeSpots(u) === 1 ? "" : "s") + ' right now. Decline options or release players to make room if you want in.</p></div>' + progressionBlock() + rookieBlock(6));
  if (o.stage === "draft") return draftStagePanel();
  if (o.stage === "signing") return signingPanel();
  // FA week
  var signed = g.fa && g.fa.log.length ? g.fa.log[g.fa.log.length - 1] : null;
  return panel("Free agency · week " + o.week + " of 3", '<p class="sm" style="margin:0 0 10px">Make offers in the <b>Free Agency</b> tab. CPU teams are bidding too. Players answer at the end of each week: some sign right away, some wait for a better deal, and by week 3 most just want a main-league spot.</p><div class="row">' + btn("tab", "Go to the free agent board", "primary sm", "contracts") + '</div>' + (signed ? '<h3 style="margin-top:12px">Week ' + signed.wk + ' signings (' + signed.signed.length + ')</h3>' + (signed.signed.length ? '<ul class="logl" style="margin:0">' + signed.signed.map(function(x){ return '<li>' + X.pl(x.pid) + ' → ' + X.tm(x.tid) + ' <span class="num">' + money(x.sal) + '</span> <span class="sm">' + DY.CON_TYPES[x.type] + (x.n > 1 ? " · " + x.n + " offers" : "") + '</span></li>'; }).join("") + '</ul>' : '<p class="empty">Nobody signed.</p>') : ''));
}
function optionsBlock(){
  var g = G(), u = DY.userT(), ids = Object.keys(g.off.opts).map(Number).filter(function(id){ return g.off.opts[id].tid === u.id; });
  if (!ids.length) return '<div class="card"><h3>Your options</h3><p class="empty" style="margin:0">No team options to decide this year.</p></div>';
  return '<div class="card"><h3>Your option decisions</h3><p class="sm" style="margin:0 0 8px">Exercise to keep him one more season at the same salary. Decline and he becomes a free agent (you can still bid on him). Budget next season: <b>' + money(u.budget) + '</b>, committed: <b>' + money(DY.payroll(u)) + '</b>.</p>' + table(["Player", "Pos", {h:"OVR", n:1}, "Change", {h:"Salary", n:1}, {h:"Market", n:1}, "Mood", ""], ids.map(function(id){ var p = P(id), o = g.off.opts[id], pr = g.off.prog[id]; return '<tr><td>' + X.pl(id) + '</td><td>' + X.role(p) + '</td><td class="n">' + X.ovr(p) + '</td><td>' + (pr ? X.delta(pr.d, 1) : "") + '</td><td class="n">' + money(p.con ? p.con.sal : 0) + '</td><td class="n">' + money(DY.marketValue(p)) + '</td><td style="width:90px">' + X.meter(p.rel) + '</td><td>' + (o.decided ? '<b class="' + (o.exercise ? "up" : "dn") + '">' + (o.exercise ? "Exercised" : "Declined") + '</b>' : btn("optYes", "Exercise", "primary sm", id) + btn("optNo", "Decline", "ghost sm", id)) + '</td></tr>'; })) + '</div>';
}
function progressionBlock(){
  var g = G(), u = DY.userT(), v = U.prog;
  var list = Object.keys(g.off.prog).map(Number).map(function(id){ return {p:P(id), x:g.off.prog[id]}; }).filter(function(z){ return z.p.status !== "retired"; });
  if (v === "mine") list = list.filter(function(z){ return z.p.team === u.id || (g.off.opts[z.p.id] && g.off.opts[z.p.id].tid === u.id) || z.p.formerTeam === u.id && z.p.team == null; });
  else if (v === "fa") list = list.filter(function(z){ return z.p.team == null; });
  list.sort(function(a, b){ return v === "fa" ? b.p.ovr - a.p.ovr : b.x.d - a.x.d; });
  var EV = {boom:'<span class="badge green">Breakout</span>', bust:'<span class="badge red">Stalled</span>', slump:'<span class="badge red">Slump</span>', renaissance:'<span class="badge green">Renaissance</span>', cliff:'<span class="badge red">Fell off</span>'};
  return '<div class="card" style="margin-top:12px"><div class="row between"><h3 style="margin:0">Progression report</h3><div class="gm-modes">' + [["mine", "My team"], ["fa", "Free agents"], ["all", "Everyone"]].map(function(x){ return '<button class="chip" data-a="progView" data-arg="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div></div><p class="sm" style="margin:6px 0 8px">How every player developed this offseason. Free agents who improved are worth a look; aging starters who slipped may need replacing.</p>' +
    table(["Player", "Pos", "Status", "Stage", {h:"Was", n:1}, {h:"Now", n:1}, {h:"Change", n:1}, {h:"POT", n:1}, "", "How he changed"], list.slice(0, 80).map(function(z){ var p = z.p; return '<tr><td>' + X.pl(p.id) + '</td><td>' + X.role(p) + '</td><td class="sm">' + (p.team != null ? esc(T(p.team).abbr) : "FA") + '</td><td>' + DY.stage(p) + '</td><td class="n">' + z.x.from + '</td><td class="n">' + X.ovr(p) + '</td><td class="n"><b>' + X.delta(z.x.d, 1) + '</b></td><td class="n">' + X.pot(p) + '</td><td>' + (EV[z.x.ev] || "") + '</td><td class="sm">' + (z.x.evo ? z.x.evo.map(esc).join("; ") : "") + '</td></tr>'; }), "tall") + '</div>';
}
/* ---------------- SCOUTING / ROOKIE DRAFT / SIGNINGS ---------------- */
function potCell(v){ if (v.lvl < 2) return '<span class="muted">?</span>'; return v.gLo === v.gHi ? '<span class="pot ' + v.grade[0] + '">' + v.grade + '</span>' : '<span class="pot ' + v.gLo[0] + '">' + v.gLo + '–' + v.gHi + '</span>'; }
// the class as your scouts see it. o.scout: scout buttons · o.draft: draft buttons · o.ask: asking price column · o.order: rows already sorted
function classTable(list, o){
  var g = G(), u = DY.userT(); o = o || {};
  var rows = list.map(function(p, i){ var v = DY.scoutView(p, u.id);
    return '<tr><td class="n">' + (o.order ? i + 1 : p.rookie.rank) + '</td><td>' + X.pl(p.id) + (p.rookie.holdout && v.lvl >= 1 ? ' <span class="badge" title="Wants to start his career on a contender. Costs more for weaker teams.">Picky</span>' : '') + (p.mentor != null ? ' <span class="badge" title="Learned the game under ' + esc(P(p.mentor).n) + '">Protégé of ' + esc(P(p.mentor).n) + '</span>' : '') + ' ' + X.flag(v.flag) + '</td><td>' + X.role(p) + '</td><td>' + X.dots(v.lvl) + '</td><td class="n">' + (v.lvl >= 1 ? v.lo + '–' + v.hi : '<span class="muted">?</span>') + '</td><td class="n">' + potCell(v) + '</td><td class="n muted">#' + p.rookie.rank + '</td><td class="n">' + f2(p.rookie.scout.kd) + '</td><td class="n">' + f2(p.rookie.scout.snd) + '</td><td class="sm">' + (v.lvl >= 1 ? esc(p.persona) : '<span class="muted">?</span>') + '</td>' + (o.ask ? '<td class="n">' + money(DY.askFor(p, u.id)) + '</td>' : '') + '<td style="white-space:nowrap">' + (o.scout && v.lvl < 4 ? btn("scoutP", "Scout", "ghost sm", p.id, !(u.sp >= 1)) : '') + (o.draft ? btn("rdPick", "Draft", "primary sm", p.id) : '') + '</td></tr>'; });
  return table([{h:"#", n:1}, "Prospect", "Pos", "Scouted", {h:"OVR", n:1, t:"Your scouts' overall range"}, {h:"POT", n:1, t:"Your scouts' potential read"}, {h:"Consensus", n:1}, {h:"Amateur K/D", n:1}, {h:"SnD K/D", n:1}, "Personality"].concat(o.ask ? [{h:"Asking", n:1, t:"What he'd ask from you per season"}] : []).concat([""]), rows, "tall");
}
function myPicksHtml(){
  var g = G(), u = DY.userT(), mine = DY.picksOf(u.id), odds = DY.lotteryOdds(), od = function(tid){ var x = odds.find(function(o){ return o.tid === tid; }); return x ? ' · <b>' + x.w + '%</b> lottery odds at #1' : ''; };
  var h = mine.length ? '<ul class="logl" style="margin:0">' + mine.map(function(o){ return '<li>' + X.logo(T(o), 18) + ' <b>S' + (g.season + 1) + ' first-round pick</b>' + (o !== u.id ? ' (from ' + esc(T(o).abbr) + ')' : '') + ' — projected <b>#' + DY.projSlot(o) + '</b>' + od(o) + '</li>'; }).join("") + '</ul>' : '<p class="empty" style="margin:0">You don\'t own a pick in the next draft.</p>';
  return h + '<p class="sm" style="margin:8px 0 0">Only the <b>8 worst records</b> draft. The 4 worst are in a lottery for picks 1–4 (60/20/12.5/7.5% at #1); the 5th–8th worst pick 5–8 by record. Everyone else finds rookies in free agency, so a pick from a good team is worth little and one from a top-4 team is worth nothing. <b>You need an open roster spot for each pick</b> or your turn is skipped. Picks can be traded until the draft starts.</p>';
}
function scoutingPanel(){
  var g = G(), u = DY.userT(), cls = DY.classNow(), S = DY.SCOUT[u.scout || 0], can = g.phase !== "offseason" || g.off.stage === "recap" || g.off.stage === "options";
  if (!cls.length) return panel("Scouting", '<p class="empty">The next class shows up when the season starts.</p>' + '<div style="margin-top:10px">' + scoutPicker() + '</div>');
  var known = cls.filter(function(p){ return DY.scoutLvl(p, u.id) > 0; }).length;
  return panel("Scouting · Season " + (g.season + 1) + " class · " + cls.length + " prospects", '<div class="row" style="margin-bottom:10px"><span class="pill">Scouting points <b>' + (u.sp || 0) + '</b></span><span class="pill">+' + S.pts + ' / week (' + S.n + ')</span><span class="pill">Scouted <b>' + known + '</b> of ' + cls.length + '</span></div><p class="sm" style="margin:0 0 10px">Nobody gets this for free: every team only knows what its own scouts dig up. Spend a point to take a prospect one level deeper — 1: overall range + personality, 2: potential, 3: skillset + work habits, 4: a tight read plus red flags or a generational talent. Reads are good, never perfect. ' + (can ? 'Points carry over (up to ' + DY.SP_CAP + ').' : 'Scouting is closed until next season.') + '</p>' + scoutPicker()) +
    '<div class="grid2">' + panel("Your picks", myPicksHtml()) + panel("Your roster vs the league", X.needsPanel(u.id, true)) + '</div>' +
    panel("Prospects", classTable(cls, {scout:can}));
}
function rookieBlock(n){
  var cls = DY.classNow(); if (!cls.length) return "";
  return '<div class="card" style="margin-top:12px"><div class="row between"><h3 style="margin:0">Season ' + (G().season + 1) + ' class</h3>' + btn("tab", "Scouting & draft board", "ghost sm", "draft") + '</div>' + classTable(cls.slice(0, n || 20), {scout:true}) + '</div>';
}
function draftStagePanel(){
  var g = G(), d = g.off.draft, u = DY.userT(), oc = DY.draftAdvance(), mine = oc === u.id;
  var lot = '<div class="lotto">' + d.slots.map(function(sl, i){ var L = d.lotto.find(function(x){ return x.orig === sl.orig; }), mv = L ? L.pre - L.pick : 0, done = d.picks.find(function(x){ return x.slot === i + 1; }); return '<div class="lt' + (T(sl.owner).user ? " me" : "") + (done ? " done" : "") + (i === d.n ? " now" : "") + '"><span class="num muted">#' + (i + 1) + '</span> ' + X.logo(T(sl.owner), 18) + ' <b>' + esc(T(sl.owner).abbr) + '</b>' + (sl.owner !== sl.orig ? ' <span class="sm">via ' + esc(T(sl.orig).abbr) + '</span>' : '') + (mv ? ' ' + X.delta(mv) : '') + (done && done.skip === "full" ? ' <span class="sm dn">full</span>' : done && done.skip ? ' <span class="sm muted">pass</span>' : '') + '</div>'; }).join("") + '</div>';
  var status = oc == null ? '<div class="big">The draft is complete.</div>' : mine ? '<div class="big" style="color:var(--mustard)">You\'re on the clock — slot #' + (d.n + 1) + '</div>' : '<div class="big">On the clock: ' + esc(T(oc).name) + '</div>';
  var board = DY.draftBoard(u.id).map(function(x){ return x.p; });
  var picks = d.picks.slice().reverse().map(function(x){ var p = x.pid != null ? P(x.pid) : null; return '<li><span class="num muted">#' + x.slot + '</span> ' + X.tm(x.tid, 1) + ' — ' + (p ? X.pl(p.id) + ' ' + X.role(p) : '<span class="muted">' + (x.skip === "full" ? "skipped: no open roster spot" : x.skip === "pass" ? "passed" : "passed: class ran out") + '</span>') + '</li>'; }).join("");
  return panel("Rookie draft · Season " + (g.season + 1) + " class", '<div class="row between"><div>' + status + '<div class="sm">Open roster spots: <b>' + DY.freeSpots(u) + '</b>. Only the 8 worst records draft (lottery for picks 1–4 among the worst 4). Teams without an open spot are skipped; undrafted rookies go to free agency.</div></div><div class="row">' + (mine ? btn("rdAuto", "Auto-pick", "ghost sm") + btn("rdPass", "Pass", "ghost sm") : "") + '</div></div><div style="margin-top:12px">' + lot + '</div>') +
    panel("Your board · " + board.length + " prospects left", classTable(board, {draft:mine, ask:true, order:true}) + '<p class="sm" style="margin:6px 0 0">Sorted by your scouts\' value. Asking = what he\'d want from you per season; you negotiate after the draft.</p>') +
    '<div class="grid2">' + panel("Picks", picks ? '<ul class="logl" style="margin:0">' + picks + '</ul>' : '<p class="empty">No picks yet.</p>') + panel("Your roster vs the league", X.needsPanel(u.id, true)) + '</div>';
}
X.rookieNeg = function(p){
  var g = G(), u = DY.userT(), r = p.draftRights, id = p.id, ask = DY.askFor(p, u.id), fb = (U.rk || {})[id], v = DY.scoutView(p, u.id);
  var sal = r.agreed ? r.agreed.sal : fb && fb.sal ? fb.sal : ask;
  var h = '<div class="card"><div class="row between"><div class="row" style="gap:6px">' + X.role(p) + X.pl(id) + '<span class="sm">pick #' + r.pick + ' · OVR ' + (v.lvl >= 1 ? v.lo + '–' + v.hi : '?') + ' · POT ' + potCell(v) + '</span> ' + X.flag(v.flag) + '</div>' + (r.agreed ? '<span class="badge green">Deal agreed: ' + money(r.agreed.sal) + ', ' + DY.CON_TYPES[r.agreed.type] + '</span>' : '') + '</div>';
  h += '<div class="fb" style="margin:8px 0"><div>Interest in ' + esc(u.name) + ': ' + X.interestTag(p, u.id, true) + '</div><div class="sm">Asking about <b style="color:var(--mustard)">' + money(ask) + '</b> per season' + (r.prem ? ' (up ' + Math.round(r.prem * 100) + '% — you\'ve annoyed his camp)' : '') + ' · ' + Math.max(0, 6 - r.tries) + ' offers before he walks · your space ' + money(DY.space(u)) + '</div></div>';
  h += '<div class="row" style="align-items:flex-end"><label class="fld">Salary ($k / season)<input type="number" id="neg-sal-' + id + '" min="50" max="1000" step="5" value="' + sal + '"></label><div class="fld" style="flex:0 1 220px"><span class="sm">Contract (fixed)</span><b>2 seasons + team option</b><span class="sm">rookie deal · restricted free agent after</span></div>' + btn("rkOffer", r.agreed ? "Change the deal" : "Make offer", "primary sm", id) + btn("rkDecline", "Let him go", "ghost sm", id) + '</div>';
  if (fb && fb.res) h += '<div class="fb" style="margin-top:8px"><div>' + (fb.res.accepted ? '<b class="up">He accepts.</b> It\'s a deal once signings close — going back on it with a lower salary will insult him.' : fb.res.walked ? '<b class="dn">He walked away.</b> He\'s a free agent now.' : '<b class="dn">He says no.</b>' + (fb.res.insulted ? ' He\'s insulted you tried to back out of the deal.' : '')) + (fb.res.ev && fb.res.ev.tone && !fb.res.accepted ? ' <span class="tone ' + X.toneCls(fb.res.ev.tone) + '">' + esc(fb.res.ev.tone) + '</span>' : '') + '</div>' + (fb.res.ev && fb.res.ev.why && fb.res.ev.why.length && !fb.res.accepted ? '<ul class="logl" style="margin:0">' + fb.res.ev.why.map(function(w){ return '<li>· ' + esc(w[1]) + '</li>'; }).join("") + '</ul>' : '') + '</div>';
  return h + '</div>';
};
function signingPanel(){
  var g = G(), u = DY.userT(), d = g.off.draft, mine = DY.userRights();
  var others = d.picks.filter(function(x){ return x.pid != null && x.tid !== u.id; }).map(function(x){ var p = P(x.pid); return '<li><span class="num muted">#' + x.n + '</span> ' + X.tm(x.tid, 1) + ' — ' + X.pl(p.id) + ' <span class="sm">' + (p.team != null ? money(p.con.sal) + ', ' + DY.CON_TYPES[p.con.type] : '<span class="dn">unsigned → FA</span>') + '</span></li>'; }).join("");
  return panel("Rookie signings", '<p class="sm" style="margin:0 0 10px">Negotiate with your picks. They answer right away: accept, or tell you why not. A deal is final when you close signings; going back on an agreed deal with a worse offer insults him and raises his price. Six rejected offers and he walks. Unsigned picks become free agents.</p>' + (mine.length ? '<div class="stack">' + mine.map(X.rookieNeg).join("") + '</div>' : '<p class="empty">You have no draft picks to sign.</p>') + '<div class="row" style="margin-top:10px">' + btn("openFA", "Close signings → free agency", "primary") + '</div>') +
    panel("Around the league", others ? '<ul class="logl" style="margin:0">' + others + '</ul>' : '<p class="empty">No other picks.</p>');
}
function draftRecap(){
  var g = G(), d = g.off.draft; if (!d) return scoutingPanel();
  return panel("Season " + (g.season + 1) + " rookie draft", '<ul class="logl" style="margin:0">' + d.picks.filter(function(x){ return x.pid != null; }).map(function(x){ var p = P(x.pid); return '<li><span class="num muted">#' + x.n + '</span> ' + X.tm(x.tid, 1) + ' — ' + X.pl(p.id) + ' ' + X.role(p) + ' <span class="sm">' + (p.team === x.tid ? "signed" : "unsigned → FA") + '</span></li>'; }).join("") + '</ul>');
}
function tabDraft(){
  var g = G();
  if (g.phase === "offseason"){ var st = g.off.stage; if (st === "draft") return draftStagePanel(); if (st === "signing") return signingPanel(); if (st === "fa" || st === "signed") return draftRecap(); }
  return scoutingPanel();
}

/* ---------------- MY TEAM ---------------- */
function tabTeam(){
  var g = G(), u = DY.userT(), sel = U.lineSel;
  var sub = DY.sub(u);
  var slots = u.lineup.concat(sub != null ? [sub] : []).map(function(id, i){ var p = P(id); return '<div class="lslot ' + (i === 4 ? "sub " : "") + (sel === id ? "sel" : "") + '" data-a="lineSel" data-arg="' + id + '"><span class="lab">' + (i < 4 ? "Starter" : "Sub · also plays Academy") + '</span><div class="row" style="gap:6px">' + X.role(p) + X.ovr(p) + '</div><b>' + esc(p.n) + '</b><span class="sm">' + (p.st ? f2(kd(p.st.reg.k, p.st.reg.d)) + " K/D" : "") + '</span></div>'; }).join("");
  var h = panel("Lineup", '<p class="sm" style="margin:0 0 8px">Click a starter, then the sub, to swap them. Lineups need 2 ARs and 2 SMGs (flex players count as either). ' + (g.phase === "playoffs" ? "Rosters are locked but you can still set the lineup." : "") + '</p><div class="lineup">' + slots + '</div><div class="row" style="margin-top:8px">' + btn("autoLineup", "Best lineup", "ghost sm") + '<span class="sm">Chemistry <b>' + (DY.chem(u) >= 0 ? "+" : "") + f1(DY.chem(u)) + '</b></span>' + btn("team", "Locker room", "ghost sm", u.id) + '</div>');
  h += panel("Roster & contracts", table(["Player", "Pos", {h:"OVR", n:1}, {h:"POT", n:1}, "Stage", "Contract", "Personality", "Mood", {h:"K/D", n:1}, {h:"WAR+", n:1}, ""], u.roster.map(function(id){ var p = P(id), s = p.st ? X.sLine(p.st.reg) : null; return '<tr><td>' + X.pl(id) + (p.trq ? ' <span class="badge red">Trade request</span>' : '') + '</td><td>' + X.role(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="n">' + X.pot(p) + '</td><td>' + DY.stage(p) + '</td><td class="sm">' + DY.conText(p.con) + '</td><td class="sm">' + esc(p.persona) + '</td><td style="width:80px">' + X.meter(p.rel) + '</td><td class="n">' + (s ? f2(s.kd) : "—") + '</td><td class="n">' + (s ? f2(s.war) : "—") + '</td><td>' + X.formTag(p) + '</td></tr>'; })));
  var fm = DY.fanMetrics(u), next = sumNext(u);
  h += '<div class="grid2">' + panel("Finances", kv("Budget this season", money(u.budget)) + (u.cashAdj ? kv("Cash from trades", money(u.cashAdj)) : "") + (DY.SALARY_CAP ? kv("Salary cap (spending limit)", money(Math.min(u.budget, DY.SALARY_CAP)) + (u.budget > DY.SALARY_CAP ? ' <span class="sm">(cap)</span>' : '')) : '') + (u.shareIn ? kv("Revenue sharing last offseason", (u.shareIn > 0 ? "+" : "−") + money(Math.abs(u.shareIn))) : '') + kv("Player payroll", money(DY.payroll(u) - (u.dead || 0) - DY.scoutCost(u))) + (u.dead ? kv("Dead money", money(u.dead)) : "") + kv("Scouting (" + DY.SCOUT[u.scout || 0].n + ")", money(DY.scoutCost(u))) + kv("Space", money(DY.space(u))) + kv("Committed for next season", money(next)) + (u.taxNext ? kv("Luxury tax due next season", money(u.taxNext)) : "") + '<p class="sm" style="margin:8px 0 0">Next season\'s budget follows fan engagement and how deep you go in the playoffs. Start a season over budget and half the overage comes off next season\'s budget. ' + Math.round(DY.REV_SHARE * 100) + '% of every team\'s revenue is pooled and split evenly, and nobody can spend over the ' + money(DY.SALARY_CAP || 0) + ' cap.</p><div style="margin-top:10px">' + scoutPicker() + '</div>') +
    panel("Fans", '<div class="grid4">' + [["Engagement", fm.eng + "/100"], ["Avg viewers", fm.viewers.toLocaleString()], ["Merch", money(fm.merch)], ["Social", fm.social.toLocaleString()]].map(function(x){ return '<div><div class="label">' + x[0] + '</div><div class="big num">' + x[1] + '</div></div>'; }).join("") + '</div>') + '</div>';
  h += panel("Team strategy", tagPicker() + '<div class="grid3" style="margin-top:10px">' + DY.MODES.map(function(m){ var r = DY.modeRating(u, m), rk = G().teams.map(function(t){ return DY.modeRating(t, m); }).filter(function(v){ return v > r; }).length + 1; return '<div class="card"><div class="label">' + DY.MODE_NAME[m] + '</div><div class="big num">' + f1(r) + '</div><div class="sm">' + ordinal(rk) + ' of 16</div></div>'; }).join("") + '</div>');
  return h;
}
function scoutPicker(){ var g = G(), u = DY.userT(), lv = u.scout || 0, can = g.phase === "preseason"; return '<label class="fld">Scouting department<select id="scout-lv"' + (can ? '' : ' disabled') + '>' + DY.SCOUT.map(function(s, i){ return '<option value="' + i + '"' + (i === lv ? " selected" : "") + '>' + s.n + ' · ' + money(s.c) + '/season</option>'; }).join("") + '</select></label><p class="sm" style="margin:6px 0 0">' + esc(DY.SCOUT[lv].txt) + ' Paid from your budget every season. ' + (can ? 'Set it now — it locks when the season starts.' : 'Can be changed in the preseason.') + '</p>'; }
function sumNext(t){ return t.roster.reduce(function(a, id){ var p = P(id), c = p.con; if (p.ext && p.ext.sal) return a + p.ext.sal; if (!c) return a; return a + (c.yrs >= 2 || (c.opt && c.yrs <= 1) ? c.sal : 0); }, 0); }

/* ---------------- SCHEDULE ---------------- */
function tabSchedule(){
  var g = G(), u = DY.userT(), h = "";
  if (g.po) h += panel("Playoffs · 12-team double elimination · best of 5", X.bracket() + '<p class="sm" style="margin:6px 0 0">Click a finished series with a box score to open it.</p>');
  if (g.phase === "season" || g.phase === "playoffs" || g.phase === "preseason"){
    var mine = g.sched.map(function(rd, i){ var pr = rd.pairs.find(function(p){ return p.indexOf(u.id) >= 0; }), opp = pr[0] === u.id ? pr[1] : pr[0], res = g.res.find(function(r){ return r.r === i && (r.a === u.id || r.b === u.id); });
      var won = res && ((res.a === u.id) === (res.wa > res.wb));
      return '<tr' + (i === g.round && g.phase === "season" ? ' class="me"' : '') + '><td class="n">W' + (Math.floor(i / 2) + 1) + ' M' + (i % 2 + 1) + '</td><td>' + (rd.pool ? '<span class="badge gold">Pool</span>' : '<span class="badge">Cross</span>') + '</td><td>' + X.tm(opp) + ' <span class="sm">' + T(opp).w + '-' + T(opp).l + '</span></td><td>' + (res ? '<span class="wl ' + (won ? "W" : "L") + '">' + (won ? "W" : "L") + '</span> <b class="num">' + (res.a === u.id ? res.wa + "-" + res.wb : res.wb + "-" + res.wa) + '</b>' : (i === g.round && g.phase === "season" ? "▶ Next" : "")) + '</td><td>' + (res ? btn("boxRes", "Box", "ghost sm", g.res.indexOf(res)) : "") + '</td></tr>'; });
    h += panel("Your schedule · Season " + g.season, table(["Week", "", "Opponent", "Result", ""], mine));
  }
  h += panel("Pool standings", '<div class="grid2">' + DY.POOLS.map(function(k){ return '<div><div class="label" style="margin-bottom:4px">' + DY.POOL_NAME[k] + '</div>' + poolTable(k) + '</div>'; }).join("") + '</div>');
  h += aroundLeague();
  h += panel("Academy league", academyTable());
  return h;
}
function academyTable(){ var g = G(); var ms = g.minors.slice().sort(function(a, b){ return b.w - a.w || (b.mw - b.ml) - (a.mw - a.ml); }); return table([{h:"#", n:1}, "Club", {h:"W-L", n:1}, {h:"Maps", n:1}, "Roster"], ms.map(function(m, i){ return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(m.name) + (g.mpo && g.mpo.champ === m.id ? " 🏆" : "") + '</td><td class="n">' + m.w + '-' + m.l + '</td><td class="n">' + m.mw + '-' + m.ml + '</td><td class="sm">' + m.roster.map(function(id){ return X.pl(id); }).join(", ") + '</td></tr>'; })) + '<p class="sm" style="margin:6px 0 0">Academy players are free agents. During the season you can sign them straight from their player card.</p>'; }

/* ---------------- PLAYERS ---------------- */
function tabPlayers(){
  var g = G(), f = U.pf, u = DY.userT();
  var list = DY.active();
  if (f.view === "fa") list = list.filter(function(p){ return p.team == null; });
  else if (f.view === "acad") list = list.filter(function(p){ return p.team == null && p.minor != null; });
  else if (f.view === "rook") list = list.filter(function(p){ return p.rookie && (p.yrs <= 1); });
  else if (f.view === "mine") list = list.filter(function(p){ return p.team === u.id; });
  else if (f.view === "btl") list = list.filter(function(p){ return p.team != null; });
  if (f.role !== "ALL") list = list.filter(function(p){ return p.role === f.role; });
  if (f.q){ var q = f.q.toLowerCase(); list = list.filter(function(p){ return p.n.toLowerCase().indexOf(q) >= 0; }); }
  var cur = function(p){ return p.st ? X.sLine(p.team != null || !p.st.mi.m ? (p.st.reg.m ? p.st.reg : p.st.mi) : p.st.mi) : null; };
  var key = {ovr:function(p){ return -DY.knownOvr(p); }, pot:function(p){ return DY.gradeRank(p.potG) * 100 - DY.knownOvr(p); }, kd:function(p){ var s = cur(p); return s ? -s.kd : 9; }, war:function(p){ var s = cur(p); return s ? -s.war : 9; }, snd:function(p){ var s = cur(p); return s && s.snd != null ? -s.snd : 9; }, sal:function(p){ return -(p.con ? p.con.sal : 0); }, legacy:function(p){ return -p.legacy; }, name:function(p){ return p.n.toLowerCase(); }}[f.sort] || function(p){ return -p.ovr; };
  list.sort(function(a, b){ var x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  var rows = list.slice(0, f.n).map(function(p){ var s = cur(p); return '<tr class="click' + (p.team === u.id ? " me" : "") + '" data-a="player" data-arg="' + p.id + '"><td>' + X.pl(p.id) + (p.rookie && p.yrs <= 0 ? ' <span class="badge rk">#' + p.rookie.rank + '</span>' : '') + '</td><td>' + X.role(p) + '</td><td class="sm">' + (p.team != null ? esc(T(p.team).abbr) : p.minor != null && g.minors[p.minor] ? "FA · " + esc(g.minors[p.minor].abbr) : "FA") + '</td><td>' + DY.stage(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="n">' + X.pot(p) + '</td><td class="n">' + (s ? s.m : "—") + '</td><td class="n">' + (s ? f2(s.kd) : "—") + '</td><td class="n">' + (s && s.snd != null ? f2(s.snd) : "—") + '</td><td class="n">' + (s ? f2(s.war) : "—") + '</td><td class="n">' + (p.con ? money(p.con.sal) : "—") + '</td><td class="n">' + f1(p.legacy) + '</td></tr>'; });
  var srt = function(k, h){ return {h:h, n:1, s:"pSort", k:k, on:f.sort === k}; };
  return panel("", '<div class="filters"><div class="gm-modes">' + [["all", "All"], ["btl", "BTL rosters"], ["mine", "My team"], ["fa", "Free agents"], ["acad", "Academy"], ["rook", "Rookies"]].map(function(x){ return '<button class="chip" data-a="pView" data-arg="' + x[0] + '" aria-pressed="' + (f.view === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div><div class="gm-modes">' + ["ALL", "AR", "SMG"].map(function(r){ return '<button class="chip" data-a="pRole" data-arg="' + r + '" aria-pressed="' + (f.role === r) + '">' + r + '</button>'; }).join("") + '</div><input type="search" id="pf-q" placeholder="Search" value="' + esc(f.q) + '" style="flex:1 1 140px"></div>' +
    table([{h:"Player", s:"pSort", k:"name", on:f.sort === "name"}, "Pos", "Team", "Stage", srt("ovr", "OVR"), srt("pot", "POT"), {h:"Maps", n:1}, srt("kd", "K/D"), srt("snd", "SnD K/D"), srt("war", "WAR+"), srt("sal", "Salary"), srt("legacy", "Legacy")], rows) + (list.length > f.n ? '<div class="row" style="margin-top:8px">' + btn("pMore", "Show more (" + (list.length - f.n) + ")", "ghost sm") + '</div>' : '') + '<p class="sm" style="margin:6px 0 0">Stats are this season (BTL for rostered players, Academy for free agents). Click a player for his full card.</p>');
}

/* ---------------- TRADES ---------------- */
function tabTrades(){
  var g = G(), u = DY.userT(), tr = U.tr, h = "";
  if (g.phase === "playoffs") return panel("Trades", '<p class="empty">Rosters are locked for the playoffs. Trading reopens in the offseason.</p>') + recentTrades();
  if (g.offers.length) h += panel("Offers for you", '<div class="grid2">' + g.offers.map(function(o){ var t = T(o.tid); return '<div class="card"><div class="row between"><b>' + X.tm(o.tid) + '</b>' + X.tagChip(t.tag) + '</div><div class="sm" style="margin:6px 0">They want: ' + o.get.map(X.item).join(", ") + '</div><div class="sm">You get: ' + o.give.map(X.item).join(", ") + (o.cash > 0 ? ' + <b>' + money(o.cash) + '</b> budget to you' : o.cash < 0 ? '. You add <b>' + money(-o.cash) + '</b> budget' : '') + '</div>' + (o.why ? '<div class="sm" style="margin-top:4px;color:var(--mustard)">' + esc(o.why) + '</div>' : '') + '<div class="row" style="margin-top:8px">' + btn("offerYes", "Accept", "primary sm", o.id) + btn("offerNo", "Decline", "ghost sm", o.id) + '</div></div>'; }).join("") + '</div><p class="sm" style="margin:6px 0 0">Offers expire at the end of the week.</p>');
  var bl = (g.block || []).filter(function(i){ return u.roster.indexOf(i) >= 0; }), tl = (g.targets || []).filter(function(i){ var p = P(i); return p && p.status !== "retired"; });
  h += '<div class="grid2">' + panel("Your trade block", (bl.length ? '<ul class="logl" style="margin:0">' + bl.map(function(i){ return '<li>' + X.role(P(i)) + ' ' + X.pl(i) + ' ' + X.ovr(P(i)) + ' ' + btn("blockToggle", "Remove", "ghost sm", i) + '</li>'; }).join("") + '</ul>' : '<p class="empty" style="margin:0">Empty. Put players on the block from their player card and CPU teams will make offers for them.</p>')) + panel("Your trade targets", (tl.length ? '<ul class="logl" style="margin:0">' + tl.map(function(i){ var p = P(i); return '<li>' + X.role(p) + ' ' + X.pl(i) + ' ' + X.ovr(p) + ' <span class="sm">' + (p.team != null ? esc(T(p.team).abbr) : "FA") + '</span> ' + btn("blockToggle", "", "ghost sm", -1).replace(/.*/, "") + btn("targetToggle", "Remove", "ghost sm", i) + '</li>'; }).join("") + '</ul>' : '<p class="empty" style="margin:0">Empty. Add targets from any player card; teams that own them may call you with an offer.</p>')) + '</div>';
  // builder
  var others = g.teams.filter(function(t){ return !t.user; });
  if (tr.tid == null || T(tr.tid).user) tr.tid = others[0].id;
  var B = T(tr.tid);
  var okItem = function(t){ return function(i){ return DY.isPick(i) ? DY.picksTradable() && G().picks[DY.pickOrig(i)] === t.id : t.roster.indexOf(i) >= 0; }; };
  tr.mine = tr.mine.filter(okItem(u)); tr.theirs = tr.theirs.filter(okItem(B));
  var col = function(t, sel, act){ var pk = DY.picksTradable() ? DY.picksOf(t.id) : []; return '<div class="tradecol">' + t.roster.map(function(id){ var p = P(id), on = sel.indexOf(id) >= 0; return '<label class="tchk"><input type="checkbox" data-a="' + act + '" data-arg="' + id + '"' + (on ? " checked" : "") + '>' + X.role(p) + ' <b>' + esc(p.n) + '</b> ' + X.ovr(p) + ' <small>' + DY.stage(p) + ' · ' + DY.conText(p.con) + '</small></label>'; }).join("") + pk.map(function(o){ var k = "pk" + o, on = sel.indexOf(k) >= 0; return '<label class="tchk"><input type="checkbox" data-a="' + act + '" data-arg="' + k + '"' + (on ? " checked" : "") + '><span class="badge gold">Pick</span> <b>' + esc(DY.pickName(o)) + '</b></label>'; }).join("") + '</div>'; };
  var ev = tr.ev;
  h += panel("Trade builder", '<div class="row" style="margin-bottom:10px"><label class="fld" style="flex:0 1 260px">Trade with<select id="tr-team">' + others.map(function(t){ return '<option value="' + t.id + '"' + (t.id === tr.tid ? " selected" : "") + '>' + esc(t.name) + ' (' + t.tag + ')' + (t.rivals.indexOf(u.id) >= 0 ? " · rival" : "") + '</option>'; }).join("") + '</select></label><span class="sm">' + esc(DY.TAG_TEXT[B.tag]) + ' Budget space ' + money(DY.space(B)) + '.</span></div>' +
    '<div class="grid2"><div><div class="label" style="margin-bottom:6px">You send</div>' + col(u, tr.mine, "trMine") + '</div><div><div class="label" style="margin-bottom:6px">You get from ' + esc(B.abbr) + '</div>' + col(B, tr.theirs, "trTheirs") + '</div></div>' +
    '<div class="row" style="margin-top:12px;align-items:flex-end"><label class="fld" style="flex:1 1 260px">Budget cash (− you receive · + you send): <b id="tr-cashv" style="color:var(--text)">' + cashTxt(tr.cash) + '</b><input type="range" id="tr-cash" min="-300" max="300" step="25" value="' + tr.cash + '"></label>' + btn("trCheck", "Ask what they think", "ghost") + btn("trSend", "Propose trade", "primary") + '</div>' +
    (ev ? '<div class="alert ' + (ev.ok ? "good" : "") + '" style="margin-top:10px"><span>' + esc(ev.msg) + (ev.loss ? ' <span class="sm">(value they get: ' + Math.round(ev.gain) + ' vs ' + Math.round(ev.need) + ' needed)</span>' : '') + '</span></div>' : '') +
    '<p class="sm" style="margin:8px 0 0">Teams value players by overall, age, potential, contract and what they need (role and weakest mode). Contenders want win-now talent; rebuilders want youth, potential, cash and draft picks (a high pick is worth a lot to a weak team). Uneven deals work, but extra bodies count for less — three role players won\'t land a star. Offseason trades can leave a roster short. Pool rivals charge extra. Cash moves this season\'s budget between teams (max $300k).</p>');
  return h + recentTrades();
}
function cashTxt(c){ return c === 0 ? "none" : c > 0 ? "you send " + money(c) : "you receive " + money(-c); }
function recentTrades(){ var g = G(); var list = g.tx.filter(function(x){ return x.t.indexOf("TRADE") === 0; }).slice(0, 15); return panel("Recent trades around the league", list.length ? '<ul class="logl" style="margin:0">' + list.map(function(x){ return '<li><span class="num muted">S' + x.s + ' ' + esc(x.w) + '</span> ' + esc(x.t.replace("TRADE: ", "")) + '</li>'; }).join("") + '</ul>' : '<p class="empty">No trades yet.</p>'); }

/* ---------------- CONTRACTS / FREE AGENCY ---------------- */
function tabContracts(){
  var g = G(), u = DY.userT();
  if (g.phase === "offseason"){
    if (g.off.stage === "recap") return panel("Free agency", '<p class="empty">First, review the season recap and continue to option decisions.</p>' + btn("toOptions", "Continue", "primary sm"));
    if (g.off.stage === "options") return panel("Option decisions", optionsBlock()) + panel("", rookieBlock(30));
    if (g.off.stage === "draft" || g.off.stage === "signing") return tabDraft();
    return faBoard();
  }
  var rows = u.roster.map(function(id){ var p = P(id), x = g.ext[id]; return '<tr><td>' + X.pl(id) + '</td><td>' + X.role(p) + '</td><td class="n">' + X.ovr(p) + '</td><td class="sm">' + DY.conText(p.con) + '</td><td class="n">' + money(DY.marketValue(p)) + '</td><td class="sm">' + esc(p.persona) + '</td><td style="width:80px">' + X.meter(p.rel) + '</td><td class="sm">' + (x ? (x.status === "signed" ? '<b class="up">Extended: ' + money(x.sal) + '</b>' : x.status === "broken" ? '<b class="dn">Talks broken off</b>' : 'Offer out: ' + money(x.sal) + ' · <span class="tone ' + X.toneCls(x.tone) + '">' + esc(x.tone || "") + '</span>') : DY.extEligible(p) ? (g.week >= 3 && g.phase === "season" ? btn("player", "Negotiate", "ghost sm", id) : "Eligible from week 3") : "") + '</td></tr>'; });
  var h = panel("Contracts", table(["Player", "Pos", {h:"OVR", n:1}, "Contract", {h:"Market", n:1}, "Personality", "Mood", "Extension"], rows) + '<p class="sm" style="margin:8px 0 0">Players on the last year of a deal (or an option year) can be extended after week 2. How they feel depends on their priorities, how the season is going, where they think the team is headed, and how you\'ve treated them. They answer at the end of each week.</p>');
  if (g.phase === "season" && g.week >= 3){
    var el = u.roster.filter(function(id){ return DY.extEligible(P(id)) && (!g.ext[id] || g.ext[id].status === "pending"); });
    if (el.length) h += panel("Extension talks", '<div class="stack">' + el.map(function(id){ var p = P(id); return '<div><div class="row" style="margin-bottom:6px">' + X.role(p) + X.pl(id) + X.ovr(p) + '<span class="sm">' + esc(p.persona) + ' · ' + DY.conText(p.con) + '</span></div>' + X.negotiation(p, "ext") + '</div>'; }).join("") + '</div>');
  }
  h += panel("Sign a free agent", '<p class="sm" style="margin:0">During the season, anyone without a BTL contract can be signed right away from his player card if you have budget space and a roster spot. Find them under <b>Players → Free agents</b>. ' + (g.phase === "playoffs" ? "Rosters are locked now." : "") + '</p>' + (g.phase !== "playoffs" ? '<div class="row" style="margin-top:8px">' + btn("faView", "Browse free agents", "ghost sm") + '</div>' : ''));
  return h;
}
function faBoard(){
  var g = G(), u = DY.userT(), f = U.fa;
  var list = DY.faPool();
  if (f.view === "rook") list = list.filter(function(p){ return p.rookie && p.rookie.hidden; });
  else if (f.view === "vet") list = list.filter(function(p){ return !(p.rookie && p.rookie.hidden); });
  else if (f.view === "mine") list = list.filter(function(p){ return DY.faOffersFor(p.id).some(function(o){ return o.user; }); });
  else if (f.view === "hot") list = list.filter(function(p){ return DY.faOffersFor(p.id).length > 0; });
  if (f.role !== "ALL") list = list.filter(function(p){ return p.role === f.role; });
  var key = {rank:function(p){ return -DY.marketValue(p) - (p.rookie && p.rookie.hidden ? 0 : 0); }, ovr:function(p){ return -DY.knownOvr(p); }, ask:function(p){ return -DY.askFor(p, u.id); }, offers:function(p){ return -DY.faOffersFor(p.id).length; }, pot:function(p){ return DY.gradeRank(p.potG); }}[f.sort];
  list.sort(function(a, b){ return key(a) - key(b); });
  var nd = DY.teamNeeds(u.id, true);
  var rows = list.slice(0, 120).map(function(p){
    var offs = DY.faOffersFor(p.id), mine = offs.find(function(o){ return o.user; }), top = offs.slice().sort(function(a, b){ return b.sal - a.sal; })[0], last = p.car.length ? p.car[p.car.length - 1] : null, ls = last ? X.sLine(last.reg && last.lvl === "BTL" ? last.reg : last.mi) : null, pr = g.off && g.off.prog[p.id];
    return '<tr class="click" data-a="player" data-arg="' + p.id + '"><td>' + X.pl(p.id) + (p.rookie && p.rookie.hidden && p.yrs <= 0 ? ' <span class="badge rk">#' + p.rookie.rank + '</span>' : '') + (p.formerTeam === u.id ? ' <span class="badge gold">Yours</span>' : '') + (p.rfa != null ? ' <span class="badge rk" title="Restricted free agent: ' + esc(T(p.rfa).name) + ' can match any offer">RFA · ' + esc(T(p.rfa).abbr) + '</span>' : '') + '</td><td>' + X.role(p) + '</td><td>' + DY.stage(p) + '</td><td class="n">' + X.ovr(p) + (pr ? ' ' + X.delta(pr.d) : '') + '</td><td class="n">' + X.pot(p) + '</td><td class="sm">' + (ls ? (last.lvl === "BTL" ? "BTL " : "ACA ") + f2(ls.kd) + " K/D, " + f1(ls.war) + " WAR+" : p.rookie ? "Amateur " + f2(p.rookie.scout.kd) + " K/D" : "—") + '</td><td class="n">' + money(DY.askFor(p, u.id)) + '</td><td>' + X.interestTag(p, u.id) + ' ' + X.fitChips(p, nd) + '</td><td class="n">' + (offs.length ? offs.length + (top ? ' · top ' + money(top.sal) : '') : "—") + '</td><td>' + (mine ? '<span class="tone ' + X.toneCls(mine.tone) + '">' + esc(mine.tone) + '</span> <span class="sm">' + money(mine.sal) + '</span>' : "") + '</td></tr>'; });
  var srt = function(k, h){ return {h:h, n:1, s:"faSort", k:k, on:f.sort === k}; };
  var sheets = DY.rfaPending().map(function(pid){ var x = g.fa.rfa[pid], p = P(pid); return '<div class="card"><div class="row between"><div class="row" style="gap:6px">' + X.role(p) + X.pl(pid) + X.ovr(p) + '</div>' + X.tm(x.tid) + '</div><p style="margin:8px 0">' + esc(T(x.tid).name) + ' offered <b style="color:var(--mustard)">' + money(x.sal) + '</b>, ' + DY.conName(x.type) + '. Match it and he stays.</p><div class="row">' + btn("rfaMatch", "Match", "primary sm", pid) + btn("rfaLet", "Let him go", "ghost sm", pid) + '<span class="sm">Your free space ' + money(DY.space(u) - DY.committed(u)) + '</span></div></div>'; }).join("");
  return (sheets ? panel("Offer sheets to match", '<p class="sm" style="margin:0 0 8px">Your restricted free agents signed offer sheets elsewhere. Match to keep them at the same contract. Unanswered sheets are declined when the week ends.</p><div class="grid2">' + sheets + '</div>') : '') + panel("Free agency · week " + g.off.week + " of 3", '<div class="row" style="margin-bottom:10px"><span class="pill">Budget <b>' + money(u.budget) + '</b></span><span class="pill">Payroll <b>' + money(DY.payroll(u)) + '</b></span><span class="pill">Pending offers <b>' + money(DY.committed(u)) + '</b></span><span class="pill ' + (DY.space(u) - DY.committed(u) < 0 ? "bad" : "good") + '">Free <b>' + money(DY.space(u) - DY.committed(u)) + '</b></span><span class="pill">Open spots <b>' + DY.openSlots(u) + '</b></span></div>' +
    '<details style="margin:0 0 10px"><summary class="sm" style="cursor:pointer">Your lineup vs the league (needs)</summary><div style="margin-top:8px">' + X.needsPanel(u.id, true) + '</div></details>' +
    '<div class="filters"><div class="gm-modes">' + [["all", "Everyone"], ["vet", "Veterans"], ["rook", "Rookies"], ["hot", "Being pursued"], ["mine", "My offers"]].map(function(x){ return '<button class="chip" data-a="faView2" data-arg="' + x[0] + '" aria-pressed="' + (f.view === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div><div class="gm-modes">' + ["ALL", "AR", "SMG"].map(function(r){ return '<button class="chip" data-a="faRole" data-arg="' + r + '" aria-pressed="' + (f.role === r) + '">' + r + '</button>'; }).join("") + '</div></div>' +
    table(["Player", "Pos", "Stage", srt("ovr", "OVR"), srt("pot", "POT"), "Last season", srt("ask", "Ask"), {h:"Interest in you", t:"How he feels about your team before money: winning, playing time, friends or feuds on your roster, history with your franchise"}, srt("offers", "Offers"), "Your offer"], rows, "tall") + '<p class="sm" style="margin:8px 0 0">Click a player to see his priorities, every offer on the table, and to make or edit yours. Players under contract can\'t be signed — trade for them instead.</p><div class="row" style="margin-top:10px">' + btn("endFAWeek", g.off.week < 3 ? "End week " + g.off.week : "Finish free agency", "primary") + '</div>') + panel("", rookieBlock(30));
}

/* ---------------- LEAGUE ---------------- */
var STATCOLS = [["kd", "K/D", 2, function(s){ return s.kd; }], ["ser", "Series", 0, function(s){ return s.sw + s.sl; }], ["ovr", "OVR", 0, null], ["war", "WAR+", 2, function(s){ return s.war; }], ["war10", "WAR+/10", 2, function(s){ return s.war10; }], ["ipm", "Int/Map", 1, function(s){ return s.ipm; }], ["hp", "HP K/D", 2, function(s){ return s.hp; }], ["hill", "Hill Time", 0, function(s){ return s.hill; }], ["snd", "SnD K/D", 2, function(s){ return s.snd; }], ["sobj", "SnD Obj", 2, function(s){ return s.sobj; }], ["fb", "FB/SnD", 2, function(s){ return s.fb; }], ["ctl", "CTL K/D", 2, function(s){ return s.ctl; }], ["ok", "Obj K/CTL", 1, function(s){ return s.ok; }], ["so", "Szn OVR", 0, function(s){ return s.so; }]];
function tabLeague(){
  var g = G(), v = U.lg, h = '<div class="subtabs">' + [["stand", "Standings"], ["stats", "Player stats"], ["power", "Power rankings"], ["teams", "Teams"], ["acad", "Academy"]].map(function(x){ return '<button class="chip" data-a="lgView" data-arg="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (v === "stand") h += panel("Standings · Season " + g.season, standingsTable());
  else if (v === "stats") h += statsPanel();
  else if (v === "power"){
    var prev = g.news.find(function(n){ return n.type === "power" && n.pr; });
    h += panel("Power rankings", prev ? table([{h:"#", n:1}, "Team", "Pool", {h:"Record", n:1}, {h:"Move", n:1}, {h:"OVR", n:1}, "Tag"], prev.pr.map(function(r){ var t = T(r.id); return '<tr class="' + (t.user ? "me" : "") + '"><td class="n">' + r.rk + '</td><td>' + X.logo(t, 22) + ' ' + X.tm(r.id) + '</td><td>' + DY.POOL_NAME[t.pool] + '</td><td class="n">' + r.rec + '</td><td class="n">' + (r.mv ? X.delta(r.mv) : "–") + '</td><td class="n">' + f1(DY.teamRating(t)) + '</td><td>' + X.tagChip(t.tag) + '</td></tr>'; })) + '<p class="sm" style="margin:6px 0 0">From Stephen A. Sizzle\'s latest rankings (' + esc(prev.w) + ', Season ' + prev.s + ').</p>' : powerTable(g.pr, true));
  } else if (v === "teams"){
    h += '<div class="grid3">' + g.teams.slice().sort(function(a, b){ return a.pool < b.pool ? -1 : a.pool > b.pool ? 1 : b.w - a.w; }).map(function(t){ var fm = DY.fanMetrics(t), star = t.roster.slice().sort(function(a, b){ return P(b).ovr - P(a).ovr; })[0]; return '<div class="card' + (t.user ? " me" : "") + '" data-a="team" data-arg="' + t.id + '" style="cursor:pointer"><div class="row between">' + X.logo(t, 40) + X.tagChip(t.tag) + '</div><div class="big" style="margin:6px 0 2px;font-size:18px">' + esc(t.name) + '</div><div class="sm">' + DY.POOL_NAME[t.pool] + ' · ' + t.w + '-' + t.l + ' · OVR ' + f1(DY.teamRating(t)) + (t.titles ? ' · 🏆×' + t.titles : '') + '</div><div class="sm" style="color:var(--mustard)">' + (t.user ? "Your front office" : esc(DY.PLAN_NAME[t.plan] || "")) + '</div><div class="sm">Star: ' + (star != null ? esc(P(star).n) + ' (' + Math.round(P(star).ovr) + ')' : '—') + ' · Fans ' + fm.eng + ' · ' + money(t.budget) + '</div></div>'; }).join("") + '</div>';
  } else h += panel("Academy league", academyTable());
  return h;
}
function standingsTable(){
  var g = G(), st = DY.leagueStandings(), place = {}; DY.POOLS.forEach(function(k){ DY.poolStandings(k).forEach(function(t, i){ place[t.id] = i + 1; }); });
  var rec = function(t, m){ var r = t.mrec && t.mrec.s && t.mrec.s[m]; return r ? r[0] + "-" + r[1] : "0-0"; };
  var view = U.standView || "league";
  var head = ["#", "Team", "Pool", {h:"W-L", n:1}, {h:"Maps", n:1}, {h:"Diff", n:1}, {h:"Map %", n:1}, {h:"HP", n:1}, {h:"SnD", n:1}, {h:"CTL", n:1}, {h:"Streak", n:1}, "Last 5", "Tag"];
  var row = function(t, i, cut){ var gp = t.mw + t.ml; return '<tr class="' + (t.user ? "me " : "") + (cut ? "cut" : "") + '"><td class="n">' + (i + 1) + '</td><td>' + X.logo(t, 22) + ' ' + X.tm(t.id) + '</td><td class="sm">' + DY.POOL_NAME[t.pool] + ' #' + place[t.id] + '</td><td class="n"><b>' + t.w + '-' + t.l + '</b></td><td class="n">' + t.mw + '-' + t.ml + '</td><td class="n">' + X.delta(t.mw - t.ml) + '</td><td class="n">' + (gp ? Math.round(t.mw / gp * 100) + "%" : "—") + '</td><td class="n">' + rec(t, "HP") + '</td><td class="n">' + rec(t, "SND") + '</td><td class="n">' + rec(t, "CTL") + '</td><td class="n">' + (t.streak ? (t.streak > 0 ? "W" + t.streak : "L" + (-t.streak)) : "—") + '</td><td>' + (t.wk || []).slice(-5).map(function(x){ return '<span class="wl ' + x + '">' + x + '</span>'; }).join("") + '</td><td>' + X.tagChip(t.tag) + '</td></tr>'; };
  var h = '<div class="gm-modes" style="margin-bottom:10px">' + [["league", "Whole league"], ["pools", "By pool"]].map(function(x){ return '<button class="chip" data-a="standView" data-arg="' + x[0] + '" aria-pressed="' + (view === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (view === "league") h += table(head, st.map(function(t, i){ return row(t, i); }));
  else h += DY.POOLS.map(function(k){ return '<div class="label" style="margin:10px 0 4px">' + DY.POOL_NAME[k] + '</div>' + table(head, DY.poolStandings(k).map(function(t, i){ return row(t, i, i === 1); })); }).join("");
  return h + '<p class="sm" style="margin:6px 0 0">Mode records count every map played this season. Top 2 in each pool reach the winners bracket, 3rd starts in elimination, 4th is out.</p>';
}
function statsPanel(){
  var g = G(), f = U.sf = U.sf || {scope:"reg", team:"ALL", role:"ALL", min:5, sort:"kd", dir:-1, q:""};
  var bucket = f.scope;
  var list = DY.active().filter(function(p){ return p.st && p.st[bucket] && p.st[bucket].m >= f.min; });
  if (bucket !== "mi") list = list.filter(function(p){ return p.team != null || p.seasonTeam != null; });
  if (f.team !== "ALL") list = list.filter(function(p){ return String(p.team) === f.team; });
  if (f.role !== "ALL") list = list.filter(function(p){ return p.role === f.role; });
  if (f.q){ var q = f.q.toLowerCase(); list = list.filter(function(p){ return p.n.toLowerCase().indexOf(q) >= 0; }); }
  var rows = list.map(function(p){ return {p:p, s:X.sLine(p.st[bucket])}; });
  var col = STATCOLS.find(function(c){ return c[0] === f.sort; }), val = function(r){ return col[0] === "ovr" ? DY.knownOvr(r.p) : col[3](r.s); };
  rows.sort(function(a, b){ var x = val(a), y = val(b); x = x == null ? -1e9 : x; y = y == null ? -1e9 : y; return (y - x) * (f.dir < 0 ? 1 : -1); });
  var hd = [{h:"#", n:1}, "Player", "Team"].concat(STATCOLS.map(function(c){ return {h:c[1] + (f.sort === c[0] ? (f.dir < 0 ? " ▾" : " ▴") : ""), n:1, s:"statSort", k:c[0], on:f.sort === c[0]}; }));
  var body = rows.slice(0, 150).map(function(r, i){ var s = r.s, p = r.p; return '<tr class="' + (p.team === g.user ? "me" : "") + '"><td class="n">' + (i + 1) + '</td><td style="white-space:nowrap">' + X.pl(p.id) + ' ' + X.role(p) + '</td><td class="sm">' + (bucket === "mi" ? (p.minor != null && g.minors[p.minor] ? esc(g.minors[p.minor].abbr) : (p.team != null ? esc(T(p.team).abbr) + " (sub)" : "—")) : (p.team != null ? X.tm(p.team, 1) : "FA")) + '</td>' + STATCOLS.map(function(c){ if (c[0] === "ovr") return '<td class="n">' + X.ovr(p) + '</td>'; var v = c[3](s); return '<td class="n' + (c[0] === "kd" ? " b" : "") + '">' + (v == null ? "—" : c[2] ? v.toFixed(c[2]) : Math.round(v)) + '</td>'; }).join("") + '</tr>'; });
  return panel("Player stats · Season " + g.season, '<div class="filters"><div class="gm-modes">' + [["reg", "Regular season"], ["po", "Playoffs"], ["mi", "Academy"]].map(function(x){ return '<button class="chip" data-a="statScope" data-arg="' + x[0] + '" aria-pressed="' + (f.scope === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div><select id="st-team"><option value="ALL">All teams</option>' + g.teams.map(function(t){ return '<option value="' + t.id + '"' + (f.team === String(t.id) ? " selected" : "") + '>' + esc(t.name) + '</option>'; }).join("") + '</select><select id="st-role">' + ["ALL", "AR", "SMG"].map(function(r){ return '<option' + (f.role === r ? " selected" : "") + '>' + r + '</option>'; }).join("") + '</select><select id="st-min">' + [0, 5, 10, 20].map(function(n){ return '<option value="' + n + '"' + (f.min === n ? " selected" : "") + '>Min ' + n + ' maps</option>'; }).join("") + '</select><input type="search" id="st-q" placeholder="Search" value="' + esc(f.q) + '" style="flex:1 1 120px"></div>' + table(hd, body, "tall") + '<p class="sm" style="margin:6px 0 0">Click a column to sort. Hill Time is seconds per Hardpoint map; SnD Obj is plants + defuses per SnD map; FB is first bloods per SnD map.</p>');
}

/* ---------------- NEWS ---------------- */
var NEWS_F = {all:null, power:["power", "race"], moves:["trade", "move", "fa"], perf:["perf", "upset"], drama:["drama"], awards:["award", "champ", "hof", "acad"], off:["retire", "rookie", "prog", "draft"]};
function tabNews(){
  var g = G(), f = NEWS_F[U.news], items = g.news.filter(function(n){ return !f || f.indexOf(n.type) >= 0; }).slice(0, 80);
  return panel("", '<div class="byline"><span class="av">SAS</span><span><b style="color:var(--text)">Stephen A. Sizzle</b> · BTL league news desk</span></div><div class="subtabs">' + [["all", "All"], ["power", "Rankings & races"], ["moves", "Trades & signings"], ["perf", "Performances & upsets"], ["drama", "Drama"], ["awards", "Awards"], ["off", "Offseason"]].map(function(x){ return '<button class="chip" data-a="newsF" data-arg="' + x[0] + '" aria-pressed="' + (U.news === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' + newsList(items));
}

/* ---------------- HISTORY ---------------- */
function tabHistory(){
  var g = G(), v = U.hist, h = '<div class="subtabs">' + [["seasons", "Champions & awards"], ["records", "Record book"], ["legacy", "Legacy leaderboard"], ["hof", "Hall of Fame"], ["retired", "Retired players"], ["moves", "Transactions"]].map(function(x){ return '<button class="chip" data-a="histView" data-arg="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (v === "seasons"){
    h += panel("League history", g.hist.length ? table([{h:"Season", n:1}, "Champion", "Runner-up", "Grand final", "MVP", "Finals MVP", "ROY", "MIP", "Super Burger", "Academy"], g.hist.slice().reverse().map(function(r){ var A = r.aw, x = function(id){ return id != null ? X.pl(id) : "—"; }; return '<tr><td class="n">S' + r.s + '</td><td>🏆 ' + X.tm(r.champ) + '</td><td>' + X.tm(r.ru) + '</td><td class="num">' + Math.max(r.gf.wa, r.gf.wb) + '-' + Math.min(r.gf.wa, r.gf.wb) + (r.gf.reset ? " (reset)" : "") + '</td><td>' + x(A.mvp) + '</td><td>' + x(A.fmvp) + '</td><td>' + x(A.roy) + '</td><td>' + x(A.mip) + '</td><td>' + x(A.sb) + '</td><td class="sm">' + (r.acad ? esc(r.acad.champ) : "—") + '</td></tr>'; })) : '<p class="empty">Finish a season to start the history book.</p>');
    if (g.hist.length){ var last = g.hist[g.hist.length - 1]; h += panel("All-Star teams by season", table([{h:"Season", n:1}, "1st team", "2nd team"], g.hist.slice().reverse().map(function(r){ return '<tr><td class="n">S' + r.s + '</td><td class="sm">' + r.aw.as1.map(function(i){ return X.pl(i); }).join(", ") + '</td><td class="sm">' + r.aw.as2.map(function(i){ return X.pl(i); }).join(", ") + '</td></tr>'; }))); }
    var titles = g.teams.filter(function(t){ return t.titles; }).sort(function(a, b){ return b.titles - a.titles; });
    if (titles.length) h += panel("Titles by franchise", table(["Team", {h:"Titles", n:1}, "Seasons"], titles.map(function(t){ return '<tr><td>' + X.tm(t.id) + '</td><td class="n"><b>' + t.titles + '</b></td><td class="sm">' + g.hist.filter(function(r){ return r.champ === t.id; }).map(function(r){ return "S" + r.s; }).join(", ") + '</td></tr>'; })));
  } else if (v === "records"){
    h += panel("League record book", X.records(null));
    var js = []; g.teams.forEach(function(t){ (t.jerseys || []).forEach(function(j){ js.push({t:t, j:j}); }); });
    h += panel("Retired jerseys", (js.length ? table(["Player", "Franchise", {h:"Retired", n:1}], js.sort(function(a, b){ return b.j.s - a.j.s; }).map(function(x){ return '<tr><td>' + X.pl(x.j.pid) + '</td><td>' + X.tm(x.t.id) + '</td><td class="n">S' + x.j.s + '</td></tr>'; })) : '<p class="empty">No jerseys retired yet.</p>') + '<p class="sm" style="margin:6px 0 0">Rule: ' + esc(DY.JERSEY_RULE) + '</p>');
  } else if (v === "legacy"){
    var lb = DY.legacyBoard(50);
    h += panel("Legacy leaderboard · top 50", '<p class="sm" style="margin:0 0 8px">Legacy = talent (season overalls above 80 and peak) + statistical dominance (WAR+, kills) + accolades, which carry the most weight: MVP 14, Champion 8, Finals MVP 6, All-Star 1st 5, 2nd 3, ROY 3, MIP 2. Updates after every season.</p>' + table([{h:"#", n:1}, "Player", "Pos", "Status", {h:"Legacy", n:1}, {h:"Seasons", n:1}, {h:"MVP", n:1}, {h:"🏆", n:1}, {h:"All-Star", n:1}, {h:"Peak OVR", n:1}], lb.map(function(p, i){ var c = function(a){ return p.acc.filter(function(x){ return x.a === a; }).length; }; return '<tr' + (p.team === g.user ? ' class="me"' : '') + '><td class="n">' + (i + 1) + '</td><td>' + X.pl(p.id) + '</td><td>' + X.role(p) + '</td><td class="sm">' + (p.status === "retired" ? "Retired" : p.team != null ? esc(T(p.team).abbr) : "FA") + '</td><td class="n"><b>' + f1(p.legacy) + '</b></td><td class="n">' + p.car.filter(function(c){ return c.lvl === "BTL"; }).length + '</td><td class="n">' + (c("MVP") || "") + '</td><td class="n">' + (c("CHAMP") || "") + '</td><td class="n">' + ((c("AS1") + c("AS2")) || "") + '</td><td class="n">' + Math.max.apply(null, p.ovrH.map(function(x){ return x.o; }).concat([Math.round(p.ovr)])) + '</td></tr>'; }), "tall"));
  } else if (v === "hof"){
    h += panel("Dynasty Hall of Fame", '<p class="sm" style="margin:0 0 8px">' + esc(DY.HOF_RULE) + '</p>' + (g.hof.length ? table(["Player", "Pos", "Class", {h:"Legacy", n:1}, {h:"Seasons", n:1}, "Accolades"], g.hof.map(function(id){ var p = P(id), c = function(a){ return p.acc.filter(function(x){ return x.a === a; }).length; }; return '<tr><td>' + X.pl(id) + '</td><td>' + X.role(p) + '</td><td>Season ' + p.hofS + '</td><td class="n"><b>' + f1(p.legacy) + '</b></td><td class="n">' + p.yrs + '</td><td class="sm">' + [c("MVP") ? "MVP×" + c("MVP") : "", c("CHAMP") ? "🏆×" + c("CHAMP") : "", c("FMVP") ? "FMVP×" + c("FMVP") : "", (c("AS1") + c("AS2")) ? "All-Star×" + (c("AS1") + c("AS2")) : ""].filter(Boolean).join(" · ") + '</td></tr>'; })) : '<p class="empty">No one has been inducted yet.</p>'));
    var track = DY.active().filter(function(p){ return p.legacy >= DY.HOF_LEGACY * 0.6; }).sort(function(a, b){ return b.legacy - a.legacy; }).slice(0, 10);
    if (track.length) h += panel("On a Hall of Fame track (active)", table(["Player", "Team", {h:"Legacy", n:1}, "Stage"], track.map(function(p){ return '<tr><td>' + X.pl(p.id) + '</td><td>' + (p.team != null ? X.tm(p.team, 1) : "FA") + '</td><td class="n">' + f1(p.legacy) + '</td><td>' + DY.stage(p) + '</td></tr>'; })));
  } else if (v === "retired"){
    var ret = g.retiredIds.map(P).sort(function(a, b){ return b.retiredS - a.retiredS || b.legacy - a.legacy; });
    h += panel("Retired players (" + ret.length + ")", table(["Player", "Pos", {h:"Retired", n:1}, {h:"Seasons", n:1}, "Last team", {h:"Peak OVR", n:1}, {h:"Legacy", n:1}], ret.map(function(p){ return '<tr><td>' + X.pl(p.id) + '</td><td>' + X.role(p) + '</td><td class="n">S' + p.retiredS + '</td><td class="n">' + p.yrs + '</td><td class="sm">' + esc(p.lastTeam || "Academy") + '</td><td class="n">' + Math.max.apply(null, p.ovrH.map(function(x){ return x.o; }).concat([0])) + '</td><td class="n">' + f1(p.legacy) + '</td></tr>'; }), "tall"));
  } else {
    h += panel("Transactions", '<ul class="logl" style="margin:0">' + g.tx.slice(0, 150).map(function(x){ return '<li><span class="num muted">S' + x.s + ' ' + esc(x.w) + '</span> ' + esc(x.t) + '</li>'; }).join("") + '</ul>');
  }
  return h;
}

/* =====================================================================================
   EVENTS
   ===================================================================================== */
function bindHub(){
  var ts = root.querySelector("#tr-team"); if (ts) ts.onchange = function(){ U.tr.tid = +ts.value; U.tr.theirs = []; U.tr.ev = null; render(); };
  var cs = root.querySelector("#tr-cash"); if (cs){ cs.oninput = function(){ U.tr.cash = +cs.value; root.querySelector("#tr-cashv").textContent = cashTxt(U.tr.cash); }; cs.onchange = function(){ U.tr.ev = null; }; }
  var st1 = root.querySelector("#st-team"); if (st1) st1.onchange = function(){ U.sf.team = st1.value; render(); };
  var st2 = root.querySelector("#st-role"); if (st2) st2.onchange = function(){ U.sf.role = st2.value; render(); };
  var st3 = root.querySelector("#st-min"); if (st3) st3.onchange = function(){ U.sf.min = +st3.value; render(); };
  var st4 = root.querySelector("#st-q"); if (st4) st4.oninput = function(){ U.sf.q = st4.value; var pos = st4.selectionStart; render(); var q2 = root.querySelector("#st-q"); q2.focus(); q2.setSelectionRange(pos, pos); };
  var sc = root.querySelector("#scout-lv"); if (sc) sc.onchange = function(){ var e = DY.setScout(+sc.value); if (e) X.toast(esc(e)); after(); };
  var q = root.querySelector("#pf-q"); if (q) q.oninput = function(){ U.pf.q = q.value; var pos = q.selectionStart; render(); var q2 = root.querySelector("#pf-q"); q2.focus(); q2.setSelectionRange(pos, pos); };
}
function readNeg(id){ var s = document.getElementById("neg-sal-" + id), y = document.getElementById("neg-yrs-" + id), o = document.getElementById("neg-opt-" + id), d = document.getElementById("neg-drop-" + id); return {sal:Math.round((+s.value || 0) / 5) * 5, type:DY.mkType(y ? +y.value : 1, o ? o.value : ""), drop:d ? +d.value : null}; }
function showUserMatch(rec){ if (rec) X.openModal("box", rec, {live:true}); }

var A = {
  newGame:function(){ var city = root.querySelector("#su-city").value.trim(), nick = root.querySelector("#su-nick").value.trim(), abbr = root.querySelector("#su-abbr").value.trim(); if (!city){ X.toast("Enter a city."); return; } U.slot = +root.querySelector("#su-slot").value; var c1 = root.querySelector("#su-col").value; DY.newDynasty({city:city, nick:nick || "Burgers", abbr:abbr, c1:c1, c2:c1 === "#222222" ? "#f2a900" : "#141414"}, DATA); DY.draftAI(); U.tab = "home"; },
  load:function(n){ DY.loadSlot(+n, DATA).then(function(g){ if (!g){ X.toast("That save couldn't be loaded."); return; } U.slot = +n; U.tab = "home"; render(); }); return "async"; },
  delSlot:function(n){ if (!confirmStep("del" + n, "Click Delete again to erase slot " + n + ".")) return "noop"; DY.deleteSlot(+n); },
  toSetup:function(){ DY.setG(null); X.closeModal(); },
  export:function(){ var txt = DY.exportText(), u = DY.userT(), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type:"application/json"})); a.download = "btl-dynasty-" + u.abbr.toLowerCase() + "-s" + G().season + ".json"; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); return "noop"; },
  draftPick:function(id){ var e = DY.draftUser(+id); if (e) X.toast(esc(e)); if (G().draft.n >= DY.draftTotal()) X.closeModal(); },
  draftAuto:function(){ var p = DY.draftAutoUser(); if (p) DY.draftUser(p.id); },
  draftAutoAll:function(){ while (G().draft.n < DY.draftTotal()){ var p = DY.draftAutoUser(); if (!p) break; DY.draftUser(p.id); } },
  drRole:function(r){ U.dr.role = r; },
  tab:function(t){ U.tab = t; X.closeModal(); window.scrollTo({top:root.offsetTop - 70, behavior:"smooth"}); },
  speed:function(k){ U.speed = k; try { localStorage.setItem("btlg-dyn-speed", k); } catch (e){} },
  startSeason:function(){ DY.startSeason(); },
  playNext:function(){ var g = G(), u = DY.userT(), pr = DY.userMatch(); if (!pr) return; var v = DY.vetoRun(DY.vetoNew(T(pr[0]), T(pr[1])), u.id); X.openModal("pre", {kind:"reg", a:pr[0], b:pr[1], v:v, title:"Week " + g.week + " · Match " + (g.round % 2 + 1) + (g.sched[g.round].pool ? " · Pool game" : g.sched[g.round].place ? " · Same-place matchup" : "")}); return "modal"; },
  vetoPick:function(m){ var v = U.modal.arg.v, e = DY.vetoChoose(v, m); if (e) X.toast(esc(e)); DY.vetoRun(v, G().user); U.modal.keep = true; return "modal"; },
  vetoAuto:function(){ DY.vetoRun(U.modal.arg.v, -1); U.modal.keep = true; return "modal"; },
  watchRes:function(i){ var r = G().res[+i]; if (r && r.maps[0] && r.maps[0].la) X.openModal("box", r, {live:true}); return "modal"; },
  replay:function(){ var m = U.modal; m.live = true; m.cur = 0; m.evN = 0; m.keep = false; return "modal"; },
  startMatch:function(){ var a = U.modal.arg; DY.vetoRun(a.v, -1); var r = a.kind === "reg" ? DY.playRound(a.v) : DY.playPlayoff(a.v); X.closeModal(); save(); if (r) X.openModal("box", r, {live:true}); return "modal"; },
  simMatch:function(){ var a = U.modal.arg; DY.vetoRun(a.v, -1); var r = a.kind === "reg" ? DY.playRound(a.v) : DY.playPlayoff(a.v); X.closeModal(); if (r) X.openModal("box", r); },
  nextMap:function(){ var m = U.modal; m.cur++; m.evN = 0; m.keep = false; if (m.cur >= m.arg.maps.length){ m.live = false; } return "modal"; },
  skipMap:function(){ var m = U.modal; if (U.liveT){ clearInterval(U.liveT); U.liveT = null; } var mp = m.arg.maps[m.cur]; m.evN = mp && mp.ev ? mp.ev.length : 0; m.keep = true; return "modal"; },
  togglePbp:function(){ U.showPbp = !U.showPbp; U.modal.keep = true; return "modal"; },
  simWeek:function(){ var rs = DY.simWeek(), u = DY.userT(); if (rs.length) X.toast("Week done: " + rs.map(function(r){ var w = (r.a === u.id) === (r.wa > r.wb); return (w ? "W " : "L ") + Math.max(r.wa, r.wb) + "-" + Math.min(r.wa, r.wb) + " vs " + T(r.a === u.id ? r.b : r.a).abbr; }).join(" · ")); },
  simReg:function(){ DY.simToPlayoffs(); X.toast("Regular season complete. Playoff field is set."); U.tab = "home"; },
  playPO:function(){ var id = DY.poNext(); if (!id) return; var M = DY.PO[id]; X.openModal("pre", {kind:"po", a:DY.poRef(M.a), b:DY.poRef(M.b), v:DY.vetoRun(DY.vetoNew(T(DY.poRef(M.a)), T(DY.poRef(M.b))), G().user), title:"Playoffs · " + M.r + (DY.FINALS[id] ? " · no subs, full lineups" : "")}); return "modal"; },
  playPOOne:function(){ DY.playPlayoff(); },
  simPOUser:function(){ DY.simPlayoffsUntilUser(); },
  simPOAll:function(){ DY.simPlayoffsAll(); U.tab = "home"; },
  pobox:function(id){ var r = G().po.res[id]; if (r) X.openModal("box", r); return "modal"; },
  boxRes:function(i){ var r = G().res[+i]; if (r && r.maps[0] && r.maps[0].la) X.openModal("box", r); else X.toast("Box scores for other teams are only kept for the latest round."); return "modal"; },
  skipLive:function(){ if (U.liveT){ clearInterval(U.liveT); U.liveT = null; } U.modal.live = false; return "modal"; },
  toOptions:function(){ DY.toOptions(); U.tab = "home"; },
  toDraft:function(){ DY.startRookieDraft(); U.tab = "draft"; var d = G().off.draft; if (d) X.openModal("lotto", {lotto:d.lotto, rev:0}); after(); return "noop"; },
  lotSkip:function(){ if (U.modal && U.modal.kind === "lotto"){ U.modal.arg.rev = 99; U.modal.keep = true; } return "modal"; },
  rdPick:function(id){ var e = DY.userDraft(+id); X.toast(e ? esc(e) : esc(P(+id).n) + " is yours. Negotiate his deal after the draft."); },
  rdAuto:function(){ var e = DY.userDraftAuto(); if (e) X.toast(esc(e)); },
  rdPass:function(){ if (!confirmStep("rdpass", "Click Pass again to give up this pick.")) return "noop"; var e = DY.userPass(); if (e) X.toast(esc(e)); },
  scoutP:function(id){ var e = DY.scoutProspect(+id); if (e) X.toast(esc(e)); if (U.modal){ U.modal.keep = true; return "modalsave"; } },
  rkOffer:function(id){ var s = document.getElementById("neg-sal-" + id), sal = Math.round((+s.value || 0) / 5) * 5, r = DY.rookieOffer(+id, sal, DY.ROOKIE_TYPE); if (r.err){ X.toast(esc(r.err)); return "noop"; } U.rk = U.rk || {}; U.rk[id] = {sal:sal, res:r}; if (U.modal){ U.modal.keep = true; return "modalsave"; } },
  rfaMatch:function(id){ var e = DY.rfaDecide(+id, true); X.toast(e ? esc(e) : esc(P(+id).n) + " stays home!"); },
  rfaLet:function(id){ if (!confirmStep("rfal" + id, "Click again to let him sign the offer sheet.")) return "noop"; DY.rfaDecide(+id, false); },
  rkDecline:function(id){ if (!confirmStep("rkd" + id, "Click again: he becomes a free agent anyone can sign.")) return "noop"; DY.declineRights(+id); },
  talk:function(id){ var r = DY.talkItOut(+id); X.toast(r.err ? esc(r.err) : r.ok ? esc(P(+id).n) + " pulled his trade request." : "The meeting went nowhere. " + (r.fixed ? "" : "Fix what he's upset about first, then try again next season."), 4200); U.modal && (U.modal.keep = true); return "modalsave"; },
  openFA:function(){ if (DY.userRights().some(function(p){ return !p.draftRights.agreed; }) && !G().settings.auto && !confirmStep("openfa", "You still have unsigned draft picks. Click again to open free agency — they'll become free agents.")) return "noop"; DY.startFreeAgency(); U.tab = "contracts"; U.fb = {}; U.rk = {}; },
  endFAWeek:function(){ var wk = G().off.week, u = DY.userT(), s = DY.endFaWeek(), mine = s.filter(function(x){ return x.tid === u.id; }); U.fb = {}; X.toast("Week " + wk + ": " + s.length + " signing" + (s.length === 1 ? "" : "s") + (mine.length ? " — you signed " + mine.map(function(x){ return P(x.pid).n; }).join(", ") + "!" : ".")); if (G().phase === "preseason"){ U.tab = "home"; X.toast("Season " + G().season + " is here. Rookie overalls are revealed.", 4200); } },
  optYes:function(id){ DY.userOption(+id, true); }, optNo:function(id){ DY.userOption(+id, false); },
  progView:function(v){ U.prog = v; },
  player:function(id){ U.fb = U.fb || {}; X.openModal("player", +id); return "modal"; },
  team:function(id){ X.openModal("team", +id); return "modal"; },
  ptab:function(t){ U.modal.tab = t; return "modal"; }, ttab:function(t){ U.modal.tab = t; return "modal"; },
  close:function(){ X.closeModal(); return "closed"; },
  bgclose:function(a, el, ev){ if (ev.target.classList.contains("dy-modal")){ X.closeModal(); return "closed"; } return "noop"; },
  release:function(id){ if (!confirmStep("rel" + id, "Click Release again to confirm. His salary stays on your books this season.")) return "noop"; var e = DY.release(+id); if (e) X.toast(esc(e)); X.closeModal(); },
  tradeAdd:function(id){ U.tr.mine = [+id]; U.tr.ev = null; U.tab = "trades"; X.closeModal(); },
  tradeFor:function(id){ var p = P(+id); U.tr.tid = p.team; U.tr.theirs = [+id]; U.tr.ev = null; U.tab = "trades"; X.closeModal(); },
  trMine:function(id, el){ id = DY.isPick(id) ? id : +id; U.tr.mine = el.checked ? U.tr.mine.concat([id]) : U.tr.mine.filter(function(x){ return x !== id; }); U.tr.ev = null; },
  trTheirs:function(id, el){ id = DY.isPick(id) ? id : +id; U.tr.theirs = el.checked ? U.tr.theirs.concat([id]) : U.tr.theirs.filter(function(x){ return x !== id; }); U.tr.ev = null; },
  trCheck:function(){ var tr = U.tr; tr.ev = DY.evalTrade(DY.userT(), T(tr.tid), tr.mine, tr.theirs, tr.cash); },
  trSend:function(){ var tr = U.tr, ev = DY.userTrade(tr.tid, tr.mine, tr.theirs, tr.cash); tr.ev = ev; if (ev.ok){ X.toast("Trade done!"); tr.mine = []; tr.theirs = []; tr.cash = 0; tr.ev = null; } },
  offerYes:function(id){ var e = DY.acceptOffer(id); X.toast(e ? esc(e) : "Trade accepted."); },
  offerNo:function(id){ G().offers = G().offers.filter(function(o){ return o.id !== id; }); },
  setTag:function(t){ DY.setUserTag(t); },
  lineSel:function(id){ id = +id; var u = DY.userT(); if (U.lineSel == null){ U.lineSel = id; return; } if (U.lineSel === id){ U.lineSel = null; return; } var a = U.lineSel, b = id, ia = u.lineup.indexOf(a), ib = u.lineup.indexOf(b); U.lineSel = null; if (ia >= 0 && ib >= 0) return; var lu = u.lineup.slice(); if (ia >= 0) lu[ia] = b; else if (ib >= 0) lu[ib] = a; else return; var e = DY.setUserLineup(lu); if (e) X.toast(esc(e)); },
  autoLineup:function(){ var u = DY.userT(); u.lineup = DY.bestLineup(u.roster); },
  pView:function(v){ U.pf.view = v; U.pf.n = 60; }, pRole:function(r){ U.pf.role = r; }, pSort:function(k){ U.pf.sort = k; }, pMore:function(){ U.pf.n += 60; },
  faView:function(){ U.tab = "players"; U.pf.view = "fa"; }, faView2:function(v){ U.fa.view = v; }, faRole:function(r){ U.fa.role = r; }, faSort:function(k){ U.fa.sort = k; },
  lgView:function(v){ U.lg = v; }, standView:function(v){ U.standView = v; }, statScope:function(v){ U.sf.scope = v; }, statSort:function(k){ if (U.sf.sort === k) U.sf.dir = -U.sf.dir; else { U.sf.sort = k; U.sf.dir = -1; } },
  blockToggle:function(id){ var g = G(); id = +id; g.block = g.block || []; var i = g.block.indexOf(id); if (i >= 0) g.block.splice(i, 1); else g.block.push(id); U.modal && (U.modal.keep = true); return "modalsave"; },
  targetToggle:function(id){ var g = G(); id = +id; g.targets = g.targets || []; var i = g.targets.indexOf(id); if (i >= 0) g.targets.splice(i, 1); else g.targets.push(id); U.modal && (U.modal.keep = true); return "modalsave"; },
  autoToggle:function(){ DY.setAuto(!G().settings.auto); X.toast(G().settings.auto ? "Auto manager is on: the CPU will handle lineups, options, extensions, camp and free agency for you. Trades stay yours." : "Auto manager is off."); },
  campGo:function(){ var pid = +root.querySelector("#camp-p").value, f = root.querySelector("#camp-f").value, e = DY.userCamp(pid, f); X.toast(e ? esc(e) : esc(P(pid).n) + " heads to camp to work on " + DY.CAMP[f] + "."); }, newsF:function(v){ U.news = v; }, histView:function(v){ U.hist = v; },
  faOffer:function(id){ var o = readNeg(id), r = DY.userFaOffer(+id, o.sal, o.type); if (r.err){ X.toast(esc(r.err)); return "modal"; } U.fb[id] = {tone:r.ev.tone, why:r.ev.why}; U.modal && (U.modal.keep = true); return "modalsave"; },
  faWithdraw:function(id){ DY.withdrawFaOffer(+id); delete U.fb[id]; return "modalsave"; },
  signNow:function(id){ var o = readNeg(id), r = DY.inSeasonSign(+id, o.sal, o.type, o.drop); if (r.err){ X.toast(esc(r.err)); return "modal"; } if (r.no){ U.fb[id] = {tone:r.ev.tone, why:r.ev.why, no:true}; return "modal"; } X.toast(esc(P(+id).n) + " signed!"); X.closeModal(); },
  extOffer:function(id){ var o = readNeg(id), r = DY.offerExtension(+id, o.sal, o.type); if (r.err){ X.toast(esc(r.err)); return "modal"; } U.fb[id] = {tone:r.ev.tone, why:r.ev.why}; X.toast("Offer sent. He'll answer at the end of the week."); }
};
var confirmKey = null, confirmT = null;
function confirmStep(k, msg){ if (confirmKey === k){ confirmKey = null; return true; } confirmKey = k; clearTimeout(confirmT); confirmT = setTimeout(function(){ confirmKey = null; }, 4000); X.toast(msg); return false; }
function handle(ev){
  var el = ev.target.closest("[data-a]"); if (!el) return;
  var a = el.getAttribute("data-a"), arg = el.getAttribute("data-arg");
  if (!A[a]) return;
  if (el.tagName === "A") ev.preventDefault();
  if (a !== "bgclose") ev.stopPropagation();
  var r;
  try { r = A[a](arg, el, ev); } catch (e){ console.error(e); X.toast("Error: " + esc(e.message), 5000); return; }
  if (r === "noop" || r === "async") return;
  if (r === "modal"){ X.renderModal(); return; }
  if (r === "modalsave"){ X.renderModal(); render(); save(); return; }
  if (r === "closed"){ render(); return; }
  after();
}
root.addEventListener("click", handle);
mhost.addEventListener("click", handle);
mhost.addEventListener("change", function(ev){ if (ev.target.matches("input[type=checkbox][data-a]")) handle(ev); });
root.addEventListener("change", function(ev){ if (ev.target.matches("input[type=checkbox][data-a]")) handle(ev); });
document.addEventListener("keydown", function(e){ if (e.key === "Escape" && U.modal){ X.closeModal(); render(); } });
// checkboxes fire click too; avoid double toggles
root.addEventListener("click", function(ev){ if (ev.target.matches("input[type=checkbox][data-a]")) ev.stopImmediatePropagation(); }, true);

/* ---------------- boot: continue the most recent save ---------------- */
(function boot(){
  var meta = DY.readMeta(), last = Object.keys(meta).sort(function(a, b){ return meta[b].at - meta[a].at; })[0];
  if (!last){ render(); return; }
  root.innerHTML = '<div class="panel"><div class="status">Loading your dynasty…</div></div>';
  DY.loadSlot(+last, DATA).then(function(g){ if (g) U.slot = +last; render(); }).catch(function(){ render(); });
})();
})();
