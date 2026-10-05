/* DYNASTY: save slots in this browser (compressed), export/import, plus small helpers the UI uses. */
(function(root){
"use strict";
var DY = root.DY;
var G = function(){ return DY.G; };
DY.SLOTS = 3;
var KEY = function(n){ return DY.SAVE_KEY + "-s" + n; }, META = DY.SAVE_KEY + "-meta";
function store(){ try { return root.localStorage; } catch (e){ return null; } }
// round floats so the save stays small; drop data we can rebuild from the workbook profile
DY.pack = function(g){
  return JSON.stringify(g, function(k, v){
    if (k === "note" || k === "realLine") return undefined;
    if (typeof v === "number" && !Number.isInteger(v)) return Math.round(v * 100) / 100;
    return v;
  });
};
DY.unpack = function(str, data){
  var g = JSON.parse(str);
  var by = {}; (data && data.players || []).forEach(function(d){ by[d.n] = d; });
  Object.keys(g.P).forEach(function(k){ var p = g.P[k], d = p.real && by[p.n]; if (d){ p.realLine = {seasons:d.seasons, first:d.first, last:d.last, kd:d.kd, m:d.m, hp:d.hp, snd:d.snd, ctl:d.ctl, ip:d.ip, obj:d.obj, war10:d.war10, acc:d.acc, maps:d.maps}; } });
  return g;
};
DY.trimForSave = function(g){
  Object.keys(g.P).forEach(function(k){ var p = g.P[k]; if (p.status === "retired"){ p.st = null; if (p.log.length > 8) p.log.length = 8; } else if (p.log.length > 20) p.log.length = 20; });
};
DY.readMeta = function(){ var s = store(); try { return JSON.parse((s && s.getItem(META)) || "{}") || {}; } catch (e){ return {}; } };
function b64(bytes){ var s = "", CH = 0x8000; for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return root.btoa(s); }
function unb64(str){ var bin = root.atob(str), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function gzip(txt){ var cs = new root.CompressionStream("gzip"), w = cs.writable.getWriter(); w.write(new root.TextEncoder().encode(txt)); w.close(); return new root.Response(cs.readable).arrayBuffer().then(function(b){ return "GZ:" + b64(new Uint8Array(b)); }); }
function gunzip(z){ var ds = new root.DecompressionStream("gzip"), w = ds.writable.getWriter(); w.write(unb64(z.slice(3))); w.close(); return new root.Response(ds.readable).text(); }
// Saves are compressed (gzip when the browser supports it, otherwise LZ). Returns a Promise resolving to an error string or null.
DY.saveSlot = function(n){
  var s = store(), g = G(); if (!s || !g) return Promise.resolve("Saving isn't available in this browser.");
  DY.trimForSave(g);
  var txt = DY.pack(g);
  var p = root.CompressionStream ? gzip(txt).catch(function(){ return "LZ:" + root.LZString.compressToUTF16(txt); }) : Promise.resolve(root.LZString ? "LZ:" + root.LZString.compressToUTF16(txt) : txt);
  return p.then(function(z){ return writeSlot(n, z); });
};
function writeSlot(n, z){
  var s = store(), g = G();
  try { s.setItem(KEY(n), z); } catch (e){ return "Your browser storage is full. Export your save as a file to keep it."; }
  var m = DY.readMeta(), u = DY.userT();
  m[n] = {team:u.name, abbr:u.abbr, season:g.season, phase:g.phase, rec:u.w + "-" + u.l, titles:u.titles || 0, at:Date.now()};
  try { s.setItem(META, JSON.stringify(m)); } catch (e){}
  return null;
};
DY.loadSlot = function(n, data){
  var s = store(); if (!s) return Promise.resolve(null); var z = s.getItem(KEY(n)); if (!z) return Promise.resolve(null);
  var p = z.indexOf("GZ:") === 0 ? gunzip(z) : Promise.resolve(z.indexOf("LZ:") === 0 ? root.LZString.decompressFromUTF16(z.slice(3)) : z);
  return p.then(function(txt){ var g = DY.unpack(txt, data); if (!g || g.v !== DY.VERSION) return null; DY.setG(g); return g; });
};
DY.deleteSlot = function(n){ var s = store(); if (!s) return; s.removeItem(KEY(n)); var m = DY.readMeta(); delete m[n]; s.setItem(META, JSON.stringify(m)); };
DY.exportText = function(){ DY.trimForSave(G()); return DY.pack(G()); };
DY.importText = function(txt, data){ var g = DY.unpack(txt, data); if (!g || g.v !== DY.VERSION || !g.teams) throw new Error("Not a Dynasty save file."); DY.setG(g); return g; };

/* ---------- preseason camp: 2 players, one focus each ---------- */
DY.CAMP = {gun:"Slaying", hp:"Hardpoint", snd:"Search & Destroy", ctl:"Control", obj:"Objective", pot:"Potential"};
DY.campApply = function(p, f){
  var g = G();
  if (f === "pot"){ p.ceil = Math.min(99.4, p.ceil + rr(2.5, 4)); var i = DY.gradeRank(p.potG); if (i > 0) p.potG = DY.GRADES[i - 1][0]; }
  else { p.at[f] = Math.min(99, p.at[f] + rr(2, 4)); DY.setOvr(p); if (p.ceil < p.ovr) p.ceil = p.ovr; }
  p.camp = {s:g.season, f:f}; DY.addLog(p, "Preseason camp: worked on " + DY.CAMP[f] + ".");
};
function rr(a, b){ return DY.rr(a, b); }
DY.userCamp = function(pid, f){
  var g = G(), t = DY.userT(), p = g.P[pid]; g.camp = g.camp || [];
  if (g.phase !== "preseason") return "Camp runs in the preseason.";
  if (t.roster.indexOf(pid) < 0) return "Only your players can go to camp.";
  if (g.camp.length >= 2) return "You've used both camp spots this preseason.";
  if (g.camp.some(function(c){ return c.pid === pid; })) return "Pick a different player for the second spot.";
  if (!DY.CAMP[f]) return "Pick a focus.";
  if (DY.hiddenOvr(p) && f !== "pot") {}
  DY.campApply(p, f); g.camp.push({pid:pid, f:f}); return null;
};
DY.autoCamp = function(t){
  var g = G(), ps = t.roster.map(function(i){ return g.P[i]; }), picks = [];
  var young = ps.filter(function(p){ return p.age <= 23; }).sort(function(a, b){ return (b.ceil - b.ovr) - (a.ceil - a.ovr); })[0];
  if (young) picks.push([young, "pot"]);
  ps.filter(function(p){ return picks.every(function(x){ return x[0] !== p; }); }).sort(function(a, b){ return b.ovr - a.ovr; }).forEach(function(p){ if (picks.length >= 2) return; var weak = ["hp", "snd", "ctl"].sort(function(a, b){ return p.at[a] - p.at[b]; })[0]; picks.push([p, weak]); });
  picks.forEach(function(x){ DY.campApply(x[0], x[1]); if (t.user){ g.camp = g.camp || []; g.camp.push({pid:x[0].id, f:x[1]}); } });
};
DY.cpuCamps = function(){ G().teams.forEach(function(t){ if (!t.user) DY.autoCamp(t); }); };
DY.setAuto = function(on){ G().settings.auto = !!on; };

/* ---------- UI helpers ---------- */
DY.setUserLineup = function(ids){ var t = DY.userT(); if (ids.length !== 4 || ids.some(function(i){ return t.roster.indexOf(i) < 0; })) return "Pick 4 players from your roster."; if (DY.offRole(ids) > 0) return "Your lineup needs 2 ARs and 2 SMGs."; t.lineup = ids.slice(); return null; };
DY.setUserTag = function(tag){ var t = DY.userT(); if (DY.TAGS.indexOf(tag) < 0) return; t.tag = tag; t.userTag = true; };
DY.startSeason = function(){ var g = G(); if (g.phase === "preseason"){ if (g.settings.auto && (g.camp || []).length < 2) DY.autoCamp(DY.userT()); DY.cpuCamps(); g.phase = "season"; DY.news("league", "Season " + g.season + " is LIVE", "Five weeks. Ten matches. Four pools. Top two in each pool go to the winners bracket, third place starts in elimination, fourth place goes home. Let's GO.", {}); } };
DY.simWeek = function(){ var g = G(), w = g.week, out = []; while (g.phase === "season" && g.week === w){ var r = DY.playRound(); if (r) out.push(r); } return out; };
DY.simToPlayoffs = function(){ var g = G(); while (g.phase === "season") DY.playRound(); };
DY.simPlayoffsUntilUser = function(){ var g = G(); while (g.phase === "playoffs"){ var id = DY.poNext(); if (!id) break; var M = DY.PO[id], a = DY.poRef(M.a), b = DY.poRef(M.b); if ((a === g.user || b === g.user)) return id; DY.playPlayoff(); } return null; };
DY.simPlayoffsAll = function(){ var g = G(); while (g.phase === "playoffs") DY.playPlayoff(); };
DY.offStage = function(){ var g = G(); return g.phase === "offseason" ? g.off.stage : null; };
DY.toOptions = function(){ var g = G(); if (g.off && g.off.stage === "recap") g.off.stage = "options"; };
DY.seasonLabel = function(){ var g = G(); if (g.phase === "draft") return "Fantasy draft"; if (g.phase === "preseason") return "Season " + g.season + " · Preseason"; if (g.phase === "season") return "Season " + g.season + " · Week " + g.week + " of 5"; if (g.phase === "playoffs") return "Season " + g.season + " · Playoffs"; var o = g.off; return "Season " + g.season + " offseason · " + (o.stage === "recap" ? "Season recap" : o.stage === "options" ? "Progression & options" : "Free agency week " + o.week + " of 3"); };
})(typeof window !== "undefined" ? window : globalThis);
