/* Burger Town Leagues — DYNASTY: core (rng, constants, player model, ratings, money curves).
   The engine files (dyn-core, dyn-sim, dyn-market, dyn-off, dyn-news) never touch the DOM, so they also run in Node for testing. */
(function(root){
"use strict";
var DY = root.DY = root.DY || {};
DY.VERSION = 2;
DY.SAVE_KEY = "btlg-dynasty-v2";

/* ---------------- seeded rng kept inside the save, so a loaded save continues the same way ---------------- */
var G = null;
DY.setG = function(g){ G = g; DY.G = g; };
function rnd(){ var a = (G.rs = (G.rs + 0x6D2B79F5) | 0); var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function gauss(){ var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function rint(a, b){ return a + Math.floor(rnd() * (b - a + 1)); }
function rr(a, b){ return a + rnd() * (b - a); }
function pick(a){ return a[Math.floor(rnd() * a.length)]; }
function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function chance(p){ return rnd() < p; }
function wpick(items, wf){ var tot = 0, ws = items.map(function(x){ var w = Math.max(0, wf(x)); tot += w; return w; }); var t = rnd() * tot; for (var i = 0; i < items.length; i++){ t -= ws[i]; if (t <= 0) return items[i]; } return items[items.length - 1]; }
var clamp = function(x, a, b){ return Math.max(a, Math.min(b, x)); };
var mean = function(a){ return a.length ? a.reduce(function(x, y){ return x + y; }, 0) / a.length : 0; };
var sum = function(a){ return a.reduce(function(x, y){ return x + y; }, 0); };
DY.rnd = rnd; DY.gauss = gauss; DY.rint = rint; DY.rr = rr; DY.pick = pick; DY.shuffle = shuffle; DY.chance = chance; DY.wpick = wpick; DY.clamp = clamp; DY.mean = mean; DY.sum = sum;

/* ---------------- league constants ---------------- */
DY.NT = 16; DY.ROSTER = 5; DY.ROUNDS = 10; DY.WEEKS = 5;
DY.POOLS = ["N", "E", "S", "W"];
DY.POOL_NAME = {N:"North", E:"East", S:"South", W:"West"};
DY.MIN_SAL = 50;           // $k league minimum
DY.MAX_SAL = 1000;         // $k absolute max
DY.START_BUDGET = 1100;    // $k, same for every team in Season 1
DY.BUDGET_MIN = 950; DY.BUDGET_MAX = 1900;
DY.REV_SHARE = 0.4;        // share of revenue pooled and split evenly across the league
DY.SALARY_CAP = 1350;      // hard cap on spending ($k): a team can never spend more than this, however big its budget
DY.MODES = ["HP", "SND", "CTL"];
DY.MODE_NAME = {HP:"Hardpoint", SND:"Search & Destroy", CTL:"Control"};
DY.SERIES_MODES = ["HP", "SND", "CTL", "HP", "SND"];
DY.MAPS = {HP:["Checkmate","Raid","Garrison","Apocalypse","Moscow"], SND:["Raid","Standoff","Express","Moscow","Miami"], CTL:["Raid","Checkmate","Garrison"]};

/* Franchises: real US cities from league history, grouped by region. One Mighty Ducks per dynasty. */
DY.FRANCHISES = [
  {city:"Chicago", nick:"Syndicate", abbr:"CHI", c1:"#c8102e", c2:"#111111", pool:"N", mkt:1.25}, {city:"Detroit", nick:"Dirty Dogs", abbr:"DET", c1:"#1d3a8a", c2:"#c0c6cc", pool:"N", mkt:1.0},
  {city:"Minneapolis", nick:"Mighty Ducks", abbr:"MIN", c1:"#0e8f8a", c2:"#0b2b2a", pool:"N", mkt:0.95, ducks:1}, {city:"Buffalo", nick:"Brutes", abbr:"BUF", c1:"#5b6770", c2:"#d22630", pool:"N", mkt:0.85},
  {city:"Deerfield", nick:"Koshers", abbr:"DEE", c1:"#8b5a2b", c2:"#f1e3c6", pool:"N", mkt:0.8}, {city:"Rutland", nick:"Grizzlies", abbr:"RUT", c1:"#f2c230", c2:"#3a2a00", pool:"N", mkt:0.75},
  {city:"New York", nick:"Ferocity", abbr:"NYF", c1:"#ffd200", c2:"#111111", pool:"E", mkt:1.3}, {city:"Boston", nick:"Excane", abbr:"BOS", c1:"#9be22d", c2:"#163300", pool:"E", mkt:1.1},
  {city:"Brooklyn", nick:"Empire", abbr:"BKN", c1:"#e8e8e8", c2:"#111111", pool:"E", mkt:1.05}, {city:"Newark", nick:"Stars", abbr:"NWK", c1:"#7a0e1a", c2:"#f2d0a4", pool:"E", mkt:0.9},
  {city:"Bronx", nick:"Bombers", abbr:"BRX", c1:"#0c2340", c2:"#ffffff", pool:"E", mkt:0.95}, {city:"Charlotte", nick:"SYG", abbr:"CLT", c1:"#00a3ad", c2:"#0a1f33", pool:"E", mkt:0.9},
  {city:"Houston", nick:"Havoc", abbr:"HOU", c1:"#d9541e", c2:"#1b1b1b", pool:"S", mkt:1.1}, {city:"Nashville", nick:"Mighty Ducks", abbr:"NSH", c1:"#2e8b3a", c2:"#f4d35e", pool:"S", mkt:1.0, ducks:1},
  {city:"Miami", nick:"Reapers", abbr:"MIA", c1:"#00b2a9", c2:"#ff7f32", pool:"S", mkt:1.05}, {city:"Atlanta", nick:"Reign", abbr:"ATL", c1:"#c9a227", c2:"#111111", pool:"S", mkt:1.05},
  {city:"New Orleans", nick:"Knights", abbr:"NOLA", c1:"#4b2a7b", c2:"#d4af37", pool:"S", mkt:0.9}, {city:"Tampa", nick:"Red Wolves", abbr:"TB", c1:"#e01e37", c2:"#1b1b1b", pool:"S", mkt:0.9},
  {city:"Oklahoma City", nick:"Spartans", abbr:"OKC", c1:"#007ac1", c2:"#f05133", pool:"S", mkt:0.85}, {city:"St. Petersburg", nick:"Mafia", abbr:"STP", c1:"#ff7f50", c2:"#123a63", pool:"S", mkt:0.8},
  {city:"Seattle", nick:"Skies", abbr:"SEA", c1:"#0b6e99", c2:"#9ad1d4", pool:"W", mkt:1.0}, {city:"Phoenix", nick:"Hurrah", abbr:"PHX", c1:"#5a2d82", c2:"#f2a900", pool:"W", mkt:0.95},
  {city:"Las Vegas", nick:"Vanity", abbr:"LV", c1:"#b4975a", c2:"#111111", pool:"W", mkt:0.95}, {city:"Los Angeles", nick:"Nova", abbr:"LA", c1:"#c78cf2", c2:"#2a1440", pool:"W", mkt:1.3},
  {city:"San Jose", nick:"Cougars", abbr:"SJC", c1:"#a5acaf", c2:"#0b4f52", pool:"W", mkt:0.9}, {city:"San Francisco", nick:"Proxzymines", abbr:"SF", c1:"#b3995d", c2:"#8b0000", pool:"W", mkt:1.1},
  {city:"Honolulu", nick:"Hummingbirds", abbr:"HNL", c1:"#1e90ff", c2:"#fff3c4", pool:"W", mkt:0.75}
];
/* Academy (minor league) clubs: the rest of league history, plus a few extras. */
DY.ACADEMY = ["Berlin Kaos","Mexico City Warriors","London Royal Ravens","Toronto Northmen","Montreal Blizzard","Denver Altitude","Knoxville Moonshiners","Memphis Pharaohs","Louisville Thoroughbreds","Kansas City Smoke","Portland Timberwolves","Salt Lake Summit","Albuquerque Roadrunners","Austin Outlaws","San Diego Swells","Sacramento Kings Court","Pittsburgh Ironworks","Cleveland Rockers","Baltimore Harbor","Philadelphia Liberty","Columbus Comets","Indianapolis Pacers Club","Milwaukee Brewcrew","St. Louis Archers","Omaha Stampede","Tulsa Drillers","Orlando Gators","Jacksonville Tides","Richmond Rebels","Raleigh Oaks","Birmingham Steel","Boise Broncs","Anchorage Aurora","San Antonio Missions","El Paso Sundogs","Dallas Wranglers","Las Cruces Chiles","Providence Friars","Hartford Whalers Club","Buffalo Snowstorm"];

/* US cities -> lat/lon for placing a user's city in the nearest region. Unknown cities get a random pool. */
DY.CITY_GEO = {"new york":[40.7,-74],"los angeles":[34,-118.2],"chicago":[41.9,-87.6],"houston":[29.8,-95.4],"phoenix":[33.4,-112],"philadelphia":[40,-75.2],"san antonio":[29.4,-98.5],"san diego":[32.7,-117.2],"dallas":[32.8,-96.8],"san jose":[37.3,-121.9],"austin":[30.3,-97.7],"jacksonville":[30.3,-81.7],"fort worth":[32.8,-97.3],"columbus":[40,-83],"charlotte":[35.2,-80.8],"indianapolis":[39.8,-86.2],"san francisco":[37.8,-122.4],"seattle":[47.6,-122.3],"denver":[39.7,-105],"washington":[38.9,-77],"dc":[38.9,-77],"boston":[42.4,-71.1],"el paso":[31.8,-106.4],"nashville":[36.2,-86.8],"detroit":[42.3,-83],"oklahoma city":[35.5,-97.5],"portland":[45.5,-122.7],"las vegas":[36.2,-115.1],"vegas":[36.2,-115.1],"memphis":[35.1,-90],"louisville":[38.3,-85.8],"baltimore":[39.3,-76.6],"milwaukee":[43,-87.9],"albuquerque":[35.1,-106.6],"tucson":[32.2,-111],"fresno":[36.7,-119.8],"sacramento":[38.6,-121.5],"kansas city":[39.1,-94.6],"mesa":[33.4,-111.8],"atlanta":[33.7,-84.4],"omaha":[41.3,-96],"colorado springs":[38.8,-104.8],"raleigh":[35.8,-78.6],"miami":[25.8,-80.2],"long beach":[33.8,-118.2],"virginia beach":[36.9,-76],"oakland":[37.8,-122.3],"minneapolis":[45,-93.3],"tulsa":[36.2,-96],"tampa":[28,-82.5],"arlington":[32.7,-97.1],"new orleans":[30,-90.1],"nola":[30,-90.1],"wichita":[37.7,-97.3],"cleveland":[41.5,-81.7],"bakersfield":[35.4,-119],"aurora":[39.7,-104.8],"anaheim":[33.8,-117.9],"honolulu":[21.3,-157.9],"santa ana":[33.7,-117.9],"riverside":[34,-117.4],"corpus christi":[27.8,-97.4],"lexington":[38,-84.5],"stockton":[38,-121.3],"st. louis":[38.6,-90.2],"st louis":[38.6,-90.2],"saint louis":[38.6,-90.2],"pittsburgh":[40.4,-80],"cincinnati":[39.1,-84.5],"anchorage":[61.2,-149.9],"henderson":[36,-115],"greensboro":[36.1,-79.8],"plano":[33,-96.7],"newark":[40.7,-74.2],"toledo":[41.7,-83.6],"lincoln":[40.8,-96.7],"orlando":[28.5,-81.4],"chula vista":[32.6,-117],"jersey city":[40.7,-74.1],"chandler":[33.3,-111.8],"fort wayne":[41.1,-85.1],"buffalo":[42.9,-78.9],"durham":[36,-78.9],"st. petersburg":[27.8,-82.6],"st petersburg":[27.8,-82.6],"irvine":[33.7,-117.8],"laredo":[27.5,-99.5],"lubbock":[33.6,-101.9],"madison":[43.1,-89.4],"gilbert":[33.4,-111.8],"norfolk":[36.8,-76.3],"reno":[39.5,-119.8],"winston-salem":[36.1,-80.2],"glendale":[33.5,-112.2],"hialeah":[25.9,-80.3],"garland":[32.9,-96.6],"scottsdale":[33.5,-111.9],"irving":[32.8,-96.9],"chesapeake":[36.8,-76.3],"north las vegas":[36.2,-115.1],"fremont":[37.5,-122],"baton rouge":[30.5,-91.1],"richmond":[37.5,-77.4],"boise":[43.6,-116.2],"san bernardino":[34.1,-117.3],"spokane":[47.7,-117.4],"birmingham":[33.5,-86.8],"modesto":[37.6,-121],"des moines":[41.6,-93.6],"rochester":[43.2,-77.6],"tacoma":[47.3,-122.4],"fontana":[34.1,-117.4],"oxnard":[34.2,-119.2],"moreno valley":[33.9,-117.2],"fayetteville":[35.1,-78.9],"huntington beach":[33.7,-118],"yonkers":[40.9,-73.9],"glendale ca":[34.1,-118.3],"montgomery":[32.4,-86.3],"amarillo":[35.2,-101.8],"little rock":[34.7,-92.3],"akron":[41.1,-81.5],"columbus ga":[32.5,-84.9],"augusta":[33.5,-82],"grand rapids":[43,-85.7],"shreveport":[32.5,-93.8],"salt lake city":[40.8,-111.9],"huntsville":[34.7,-86.6],"mobile":[30.7,-88],"tallahassee":[30.4,-84.3],"knoxville":[36,-83.9],"chattanooga":[35,-85.3],"providence":[41.8,-71.4],"brooklyn":[40.7,-73.9],"bronx":[40.8,-73.9],"queens":[40.7,-73.8],"harlem":[40.8,-73.9],"hartford":[41.8,-72.7],"new haven":[41.3,-72.9],"syracuse":[43,-76.1],"albany":[42.7,-73.8],"burlington":[44.5,-73.2],"rutland":[43.6,-73],"deerfield":[42.2,-87.8],"portland me":[43.7,-70.3],"charleston":[32.8,-79.9],"savannah":[32.1,-81.1],"columbia":[34,-81],"jackson":[32.3,-90.2],"tuscaloosa":[33.2,-87.6],"gainesville":[29.7,-82.3],"fort lauderdale":[26.1,-80.1],"west palm beach":[26.7,-80.1],"san juan":[18.5,-66.1],"green bay":[44.5,-88],"ann arbor":[42.3,-83.7],"lansing":[42.7,-84.6],"dayton":[39.8,-84.2],"springfield":[39.8,-89.6],"peoria":[40.7,-89.6],"sioux falls":[43.5,-96.7],"fargo":[46.9,-96.8],"billings":[45.8,-108.5],"cheyenne":[41.1,-104.8],"santa fe":[35.7,-105.9],"eugene":[44.1,-123.1],"salem":[44.9,-123],"palo alto":[37.4,-122.1],"santa monica":[34,-118.5],"pasadena":[34.1,-118.1],"berkeley":[37.9,-122.3],"atlantic city":[39.4,-74.4],"trenton":[40.2,-74.8],"wilmington":[39.7,-75.5],"harrisburg":[40.3,-76.9],"scranton":[41.4,-75.7],"allentown":[40.6,-75.5],"erie":[42.1,-80.1],"morgantown":[39.6,-80],"bloomington":[39.2,-86.5],"south bend":[41.7,-86.3],"evansville":[38,-87.6],"bowling green":[37,-86.4],"murfreesboro":[35.8,-86.4],"clarksville":[36.5,-87.4],"asheville":[35.6,-82.6],"greenville":[34.9,-82.4],"waco":[31.5,-97.1],"college station":[30.6,-96.3],"galveston":[29.3,-94.8],"boulder":[40,-105.3],"fort collins":[40.6,-105.1],"provo":[40.2,-111.7],"ogden":[41.2,-112],"flagstaff":[35.2,-111.7],"tempe":[33.4,-111.9],"san marcos":[29.9,-97.9],"brownsville":[25.9,-97.5],"mcallen":[26.2,-98.2],"pensacola":[30.4,-87.2],"biloxi":[30.4,-88.9],"lafayette":[30.2,-92],"baton":[30.5,-91.1]};
DY.regionFor = function(city){
  var k = String(city || "").trim().toLowerCase().replace(/\s+/g, " "), g = DY.CITY_GEO[k] || DY.CITY_GEO[k.replace(/^the /, "")];
  if (!g){ var f = DY.FRANCHISES.find(function(x){ return x.city.toLowerCase() === k; }); if (f) return f.pool; return null; }
  var lat = g[0], lon = g[1];
  if (lon < -103) return "W";
  if (lat < 36.6) return "S";
  if (lon < -80.6) return "N";
  return "E";
};

/* ---------------- money curves ($k) ---------------- */
// What a player at this overall commands on the open market. League min $50k, the very best ~$1M.
DY.salaryFor = function(ovr){ var o = clamp(ovr, 0, 99.4); if (o <= 71) return DY.MIN_SAL; return Math.round(clamp(DY.MIN_SAL + 950 * Math.pow((o - 71) / 28.4, 2.45), DY.MIN_SAL, DY.MAX_SAL) / 5) * 5; };
DY.money = function(k){ k = Math.round(k); if (Math.abs(k) >= 1000) return "$" + (k / 1000).toFixed(2).replace(/\.?0+$/, "") + "M"; return "$" + k + "k"; };

/* ---------------- ratings ---------------- */
DY.ATTR = ["gun", "hp", "snd", "ctl", "obj"];
DY.ATTR_NAME = {gun:"Slaying", hp:"Hardpoint", snd:"Search & Destroy", ctl:"Control", obj:"Objective"};
DY.ATTR_SHORT = {gun:"SLAY", hp:"HP", snd:"SND", ctl:"CTL", obj:"OBJ"};
var W = {gun:0.30, hp:0.22, snd:0.20, ctl:0.16, obj:0.12};
DY.calcOvr = function(at){ return W.gun * at.gun + W.hp * at.hp + W.snd * at.snd + W.ctl * at.ctl + W.obj * at.obj; };
DY.setOvr = function(p){ p.ovr = clamp(DY.calcOvr(p.at) + (p.ovrAdj || 0), 40, 99.4); return p.ovr; };
// mode effectiveness used by the match engine
DY.modeEff = function(p, m){ var a = p.at; return m === "HP" ? 0.50 * a.hp + 0.30 * a.gun + 0.20 * a.obj : m === "SND" ? 0.55 * a.snd + 0.33 * a.gun + 0.12 * a.obj : 0.50 * a.ctl + 0.30 * a.gun + 0.20 * a.obj; };
DY.GRADES = [["A+",94],["A",91],["A-",88],["B+",85],["B",82],["B-",79],["C+",76],["C",73],["C-",70],["D",0]];
DY.gradeFor = function(ceil){ for (var i = 0; i < DY.GRADES.length; i++) if (ceil >= DY.GRADES[i][1]) return DY.GRADES[i][0]; return "D"; };
DY.gradeRank = function(g){ return DY.GRADES.findIndex(function(x){ return x[0] === g; }); };
DY.stage = function(p){ if (p.status === "retired") return "Retired"; if (p.yrs <= 0) return "Rookie"; if (p.yrs <= 1 && p.age <= 23) return "Rising"; var a = p.age; return a <= 22 ? "Rising" : a <= 27 ? "Prime" : a <= 30 ? "Veteran" : "Twilight"; };

/* ---------------- personality ---------------- */
DY.personaLabel = function(pr){
  var m = pr.money, w = pr.win, l = pr.loyal, t = pr.pt;
  if (w >= 0.45) return "Ring Chaser"; if (m >= 0.42) return "Paid What He's Worth"; if (l >= 0.38) return "Loyal to the Badge";
  if (t >= 0.36) return "Wants to Play"; if (w >= 0.33 && m >= 0.3) return "Winner, Gets Paid"; return "Balanced";
};
DY.PERSONA_TEXT = {"Ring Chaser":"Winning comes first. Will take less money to play for a contender.", "Paid What He's Worth":"Knows his value and expects to be paid like it.", "Loyal to the Badge":"Values loyalty. Treat him right and he stays, even through losing.", "Wants to Play":"Needs a starting spot in the main league above all.", "Winner, Gets Paid":"Wants to win and be paid fairly. Won't go cheap to a loser.", "Balanced":"A mix of money, winning and loyalty."};
function randPri(bias){
  var b = bias || {}, x = {money:rr(.15, .45) + (b.money || 0), win:rr(.15, .45) + (b.win || 0), loyal:rr(.05, .35) + (b.loyal || 0), pt:rr(.05, .3) + (b.pt || 0)}, s = x.money + x.win + x.loyal + x.pt;
  Object.keys(x).forEach(function(k){ x[k] = Math.round(Math.max(.02, x[k]) / s * 100) / 100; }); return x;
}
DY.randPri = randPri;
// Hand-tuned profiles for players with scouting notes in the workbook's Player Info tab.
var HAND = {
  "Hype":{pri:{money:.25, win:.45, loyal:.12, pt:.18}, cons:85, clutch:62, lead:62, chem:72, work:75, age:26},
  "Ephrisy":{pri:{money:.3, win:.42, loyal:.12, pt:.16}, cons:93, clutch:90, lead:55, chem:76, work:58, age:25},
  "Aj":{pri:{money:.15, win:.35, loyal:.36, pt:.14}, cons:80, clutch:68, lead:74, chem:46, work:80, age:27},
  "Renicide":{pri:{money:.3, win:.34, loyal:.2, pt:.16}, cons:76, clutch:84, lead:58, chem:70, work:74, age:26},
  "Acro Ace":{pri:{money:.2, win:.36, loyal:.3, pt:.14}, cons:90, clutch:66, lead:55, chem:88, work:66, age:27},
  "CrazieViews":{pri:{money:.18, win:.5, loyal:.14, pt:.18}, cons:66, clutch:85, lead:96, chem:60, work:55, age:27, avail:.07},
  "Jmetree":{pri:{money:.2, win:.5, loyal:.15, pt:.15}, cons:93, clutch:72, lead:60, chem:86, work:72, age:25},
  "Inkster":{pri:{money:.3, win:.42, loyal:.1, pt:.18}, cons:80, clutch:88, lead:58, chem:72, work:76, age:22, ceil:6},
  "Aurora":{pri:{money:.32, win:.3, loyal:.14, pt:.24}, cons:55, clutch:70, lead:45, chem:62, work:82, age:23, ceil:4},
  "Nastyy":{pri:{money:.2, win:.36, loyal:.3, pt:.14}, cons:64, clutch:78, lead:62, chem:78, work:50, age:31, avail:.06},
  "Crooked":{pri:{money:.25, win:.45, loyal:.12, pt:.18}, cons:66, clutch:92, lead:74, chem:66, work:52, age:27, avail:.08},
  "Waly":{pri:{money:.3, win:.38, loyal:.14, pt:.18}, cons:85, clutch:80, lead:55, chem:38, work:62, age:30},
  "Proxzify":{pri:{money:.3, win:.28, loyal:.22, pt:.2}, cons:72, clutch:55, lead:45, chem:66, work:60, age:28},
  "Utopian":{pri:{money:.1, win:.36, loyal:.34, pt:.2}, cons:50, clutch:60, lead:55, chem:93, work:68, age:24, ceil:4},
  "Habibi":{pri:{money:.25, win:.35, loyal:.2, pt:.2}, cons:72, clutch:60, lead:45, chem:86, work:70, age:23, ceil:4},
  "Lewy":{pri:{money:.38, win:.3, loyal:.08, pt:.24}, cons:58, clutch:70, lead:48, chem:24, work:92, age:26},
  "Karnij":{pri:{money:.3, win:.3, loyal:.16, pt:.24}, cons:55, clutch:58, lead:45, chem:65, work:55, age:25, avail:.04},
  "Boogey":{pri:{money:.24, win:.3, loyal:.26, pt:.2}, cons:70, clutch:55, lead:45, chem:80, work:60},
  "Docsukii":{pri:{money:.22, win:.32, loyal:.28, pt:.18}, cons:68, clutch:72, lead:45, chem:86, work:62},
  "Toremeant":{pri:{money:.3, win:.3, loyal:.16, pt:.24}, cons:60, clutch:60, lead:40, chem:70, work:60},
  "Bleepa":{pri:{money:.1, win:.4, loyal:.3, pt:.2}, cons:50, clutch:62, lead:50, chem:92, work:64},
  "Shadow":{pri:{money:.22, win:.3, loyal:.3, pt:.18}, cons:72, clutch:52, lead:50, chem:82, work:58},
  "Peach":{pri:{money:.2, win:.3, loyal:.2, pt:.3}, cons:62, clutch:55, lead:45, chem:82, work:88, age:20, ceil:9},
  "Realm":{pri:{money:.26, win:.3, loyal:.2, pt:.24}, cons:66, clutch:55, lead:45, chem:72, work:60},
  "aldo":{pri:{money:.2, win:.26, loyal:.14, pt:.4}, cons:60, clutch:58, lead:40, chem:70, work:72, age:20, ceil:7},
  "Chadwick":{pri:{money:.2, win:.26, loyal:.14, pt:.4}, cons:60, clutch:58, lead:40, chem:70, work:72, age:21, ceil:8}
};

/* AJ's calls: objective players the data doesn't capture (or under-sells). [low, high] objective range per dynasty. */
DY.OBJ_BOOST = {Starry:[88, 94], Dez:[86, 92], Jealous:[88, 94], Python:[88, 94], Bleepa:[87, 93]};
/* AJ's role types (Player Notes): small skill / aggression leanings on top of the stats. entry = where his aggression sits (0-100). */
DY.RTYPE = {
  "Slayer SMG":{role:"SMG", gun:2, obj:-3, entry:76, style:"Aggressive"},
  "OBJ SMG":{role:"SMG", gun:-1, obj:7, entry:52, style:"Objective player"},
  "Entry SMG":{role:"SMG", entry:88, obj:-1, style:"Aggressive"},
  "Well-rounded SMG":{role:"SMG", gun:1, obj:2, entry:60, style:"Balanced"},
  "Anchor AR":{role:"AR", gun:1, obj:-2, entry:26, style:"Slow / anchor"},
  "Quick AR":{role:"AR", obj:1, entry:66, style:"Fast-paced"},
  "Slayer AR":{role:"AR", gun:2.5, obj:-2, entry:58, style:"Balanced"}
};
DY.RTYPES = {SMG:["Slayer SMG", "OBJ SMG", "Entry SMG", "Well-rounded SMG"], AR:["Anchor AR", "Quick AR", "Slayer AR"]};
DY.PERS = ["Leader / IGL", "Balanced", "Reserved"];
// best-guess role type from a player's numbers (rookies, fictional players, old saves)
DY.guessRtype = function(p){
  if (p.role === "SMG") return p.at.obj >= 82 ? "OBJ SMG" : p.entry >= 80 ? "Entry SMG" : p.entry >= 66 ? "Slayer SMG" : "Well-rounded SMG";
  return p.entry <= 38 ? "Anchor AR" : p.entry >= 62 ? "Quick AR" : "Slayer AR";
};
// role type, flex and personality for players without notes
DY.fillTraits = function(p){
  if (!p.rtype) p.rtype = DY.guessRtype(p);
  if (p.flexT === undefined || p.flexT === null) p.flexT = p.flex != null ? "Flexible" : chance(0.3) ? "Flexible" : p.role === "SMG" ? "SMG only" : "AR only";
  if (!p.pers) p.pers = p.lead >= 82 ? "Leader / IGL" : p.lead <= 44 ? "Reserved" : "Balanced";
};
/* ---------------- player creation ---------------- */
DY.newStats = function(){ return {m:0, k:0, d:0, hm:0, hk:0, hd:0, sm:0, sk:0, sd:0, cm:0, ck:0, cd:0, hill:0, pl:0, df:0, fb:0, fd:0, ok:0, war:0, sw:0, sl:0, best:0}; };
DY.addStats = function(a, b){ Object.keys(b).forEach(function(k){ if (k === "best") a.best = Math.max(a.best || 0, b.best || 0); else a[k] = (a[k] || 0) + (b[k] || 0); }); return a; };
function baseP(id, name){
  return {id:id, n:name, real:false, role:"AR", at:{gun:70, hp:70, snd:70, ctl:70, obj:70}, ovr:70, ceil:75, potG:"C", age:22, yrs:0, exp0:0,
    cons:70, clutch:60, lead:50, chem:65, work:65, avail:.025, entry:50, pri:randPri(), persona:"Balanced",
    status:"fa", team:null, minor:null, con:null, rel:60, form:0, hot:0, mood:0, st:null, car:[], acc:[], log:[], ovrH:[], legacy:0, trq:0, rookie:null, ext:null, prevTeams:[], tmem:{}};
}
// Build a real player's Dynasty profile from career data (see scripts/games/build_dynasty_data.py).
// Skills are set RELATIVE TO THE LEAGUE: mode K/Ds vs his own K/D compared with how the league splits,
// so a 95 who is great in SnD but ordinary in Control shows it. Objective is its own skill (hill time,
// plants/defuses, CTL objective kills): a 72 overall SMG can be an elite objective player.
var TAGMAP = {
  cons:{"Very consistent":90, "Normal":70, "Streaky":50}, chem:{"Great vibes":88, "Good":70, "Hard to play with":30},
  avail:{"Always there":0.008, "Sometimes busy":0.03, "Often busy":0.06},
  entry:{"Aggressive":82, "Fast-paced":74, "Balanced":52, "Slow / anchor":28, "Objective player":55},
  age:{"Young / still improving":[19, 21], "Prime":[23, 26], "Veteran":[28, 29], "Older / declining":[31, 33]},
  pri:{"Money":{money:.22}, "Winning":{win:.22}, "Loyalty":{loyal:.24}, "Playing time":{pt:.22}, "Balanced":{}}
};
DY.realPlayer = function(d, id, N){
  var p = baseP(id, d.n), h = HAND[d.n] || {}, tg = d.tags || {}, fl = tg.flags || [], has = function(f){ return fl.indexOf(f) >= 0; };
  p.real = true; p.role = d.r === "SMG" ? "SMG" : "AR";
  if (tg.role === "AR" || tg.role === "SMG") p.role = tg.role;            // AJ's call on his main role
  else if (tg.role === "FLEX"){ p.flex = 1; }                             // true flex: plays either role at full strength
  var RT = DY.RTYPE[tg.rtype];
  if (RT && !tg.role && p.flex == null) p.role = RT.role;
  p.rtype = RT ? tg.rtype : null; p.flexT = tg.flex || (p.flex != null ? "Flexible" : null); p.pers = tg.personality || null;
  // skills are built from his TALENT (career overall minus longevity/trophy credit); the rest of his overall is reputation (p.ovrAdj) that fades over the years
  var shrink = function(n, k){ return n / (n + k); }, m = d.m, base = d.ovr - 1 - (d.tal != null ? Math.max(0, d.ovr - d.tal) * 0.6 : 0);
  var f = N.fit[p.role], resid = d.kd - (f.a + f.b * d.ovr);
  var gun = base + clamp(resid * 48, -10, 10) * shrink(m, 18);
  var modeOff = function(x, key){ if (x == null || !d.kd) return gauss() * 2.5; var r = x / d.kd, z = (r - N.ratio[key][0]) / N.ratio[key][1]; return clamp(z * 4.6, -11, 11) * shrink(m, 28); };
  var best = {"Hardpoint":"hp", "SnD":"snd", "Control":"ctl"}[tg.best];
  var at = {gun:gun, hp:base + modeOff(d.hp, "hp"), snd:base + modeOff(d.snd, "snd"), ctl:base + modeOff(d.ctl, "ctl")};
  if (best) at[best] += 3.5;
  if (tg.best === "All modes"){ var mm = (at.hp + at.snd + at.ctl) / 3; ["hp", "snd", "ctl"].forEach(function(k){ at[k] = mm + (at[k] - mm) * 0.5 + 1; }); }
  // objective: from Season 5-6 boards where we have them, otherwise role + playstyle + a guess
  // Objective is its OWN skill: a 75-overall player who lives on the hill and plays the objective is a 90+ objective player.
  var o = d.obj, obj, NO = N.obj, OB = DY.OBJ_BOOST[d.n];
  if (o){
    var num = 0, den = 0, top = -9, add = function(z, w, n){ if (z == null || !isFinite(z)) return; var zz = clamp(z, -3, 4) * n / (n + 2); num += zz * w; den += w; top = Math.max(top, zz); };
    if (o.hill != null) add((o.hill - NO[p.role].hill) / NO[p.role].hsd, 0.45, o.hillN || 0);
    if (o.pl != null) add(((o.pl + 2 * (o.df || 0)) - NO.pd[0]) / NO.pd[1], 0.25, o.plN || 0);
    if (o.ok != null) add((o.ok - NO.ok[0]) / NO.ok[1], 0.3, o.okN || 0);
    var zc = den ? (num / den) * 0.6 + Math.max(0, top) * 0.4 : 0;    // a standout objective stat counts on its own
    obj = (p.role === "SMG" ? 76 : 71) + clamp(zc * 13, -24, 24) + (d.ovr - 80) * 0.08;
  } else {
    obj = (p.role === "SMG" ? 75 : 68) + (d.ovr - 80) * 0.1 + gauss() * 7;
    if (chance(0.12)) obj = Math.max(obj, rr(84, 93));          // a few unknowns are objective specialists in any given dynasty
  }
  if (has("objplus")) obj += 4; if (has("objminus")) obj -= 9; if (tg.style === "Objective player") obj += 8; if (tg.style === "Slow / anchor") obj -= 3;
  if (OB) obj = Math.max(obj, rr(OB[0], OB[1]));
  at.obj = obj;
  if (RT){ at.gun += RT.gun || 0; at.obj += RT.obj || 0; }
  DY.ATTR.forEach(function(k){ at[k] = clamp(at[k], 40, 99); });
  p.at = at; p.ovrAdj = 0; p.ovrAdj = d.ovr - DY.calcOvr(at); DY.setOvr(p);
  // first bloods / aggression
  var entryData = o && o.fb != null ? clamp(50 + (o.fb - 1.2) * 22 * shrink(o.fbN, 4) + (d.ip - 37) * 1.2, 15, 95) : clamp(50 + (d.ip - 37) * 2.2 + gauss() * 7, 15, 95);
  p.entry = tg.style ? Math.round(entryData * 0.4 + TAGMAP.entry[tg.style] * 0.6) : entryData;
  if (RT) p.entry = Math.round(clamp(p.entry * 0.55 + RT.entry * 0.45, 10, 97));
  // career clock: stage tag, or league experience (one recent season = still rising)
  p.exp0 = d.seasons; p.yrs = d.seasons;
  var ar = TAGMAP.age[tg.stage];
  if (ar) p.age = Math.round(rr(ar[0], ar[1]));
  else if (h.age) p.age = h.age;
  else if (d.seasons === 1 && d.last >= 5 || has("debut")) p.age = rint(19, 21);
  else if (d.seasons === 2 && d.last === 6) p.age = rint(20, 22);
  else p.age = Math.round(19.5 + d.seasons * 0.8 + rr(0, 4.5) + (d.last < 5 ? 1.5 : 0));
  var room = p.age <= 21 ? rr(2, 10) : p.age <= 23 ? rr(1, 7) : p.age <= 26 ? rr(0, 4) : rr(0, 1.5);
  if (m < 20) room += rr(0, 5);
  var ceil0 = clamp(p.ovr + room + (h.ceil || 0), p.ovr, 99);                         // what scouts expect
  p.ceil = clamp(p.ovr + (room + (h.ceil || 0)) * (p.age <= 23 ? rr(0.35, 1.3) : 1), p.ovr, 99);   // what he can actually reach — a high-potential kid isn't guaranteed to hit it
  // traits: tags first, then hand notes, then stats
  p.cons = TAGMAP.cons[tg.consistency] != null ? TAGMAP.cons[tg.consistency] + gauss() * 3 : (h.cons || clamp(68 + gauss() * 10 - (m < 15 ? 6 : 0), 35, 92));
  if (has("mistakes")) p.cons -= 7;
  p.clutch = has("clutch") ? rr(86, 94) : (h.clutch || clamp(60 + gauss() * 12 + (d.acc.champ ? 6 : 0), 30, 95));
  p.lead = has("lead") ? rr(88, 96) : (h.lead || clamp(46 + gauss() * 12 + d.acc.mvp * 8 + d.seasons * 2 + (tg.tier === "Star / captain" ? 12 : 0), 20, 95));
  if (has("iq")){ p.clutch = Math.max(p.clutch, 80); p.lead = Math.max(p.lead, 75); }
  p.chem = TAGMAP.chem[tg.teammate] != null ? TAGMAP.chem[tg.teammate] + gauss() * 3 : (h.chem || clamp(68 + gauss() * 12, 30, 95));
  if (has("conflict")) p.chem -= 12; if (has("unselfish") || has("glue")) p.chem += 5;
  if (d.n === "Jealous"){ p.chem = Math.max(p.chem, rr(86, 93)); p.lead = Math.max(p.lead, rr(82, 90)); }   // a great teammate and a voice in the room
  if (p.pers === "Leader / IGL") p.lead = Math.max(p.lead, rr(84, 94));
  else if (p.pers === "Reserved"){ p.lead = Math.min(p.lead, rr(36, 52)); p.chem += 2; }
  p.work = has("work") ? rr(86, 95) : has("lazy") ? rr(45, 58) : (h.work || clamp(62 + gauss() * 12, 30, 95));
  p.avail = TAGMAP.avail[tg.availability] != null ? TAGMAP.avail[tg.availability] : (h.avail || clamp(.02 + Math.abs(gauss()) * .012, .008, .06));
  if (has("rust")) p.avail += 0.015;
  ["cons", "clutch", "lead", "chem", "work"].forEach(function(k){ p[k] = clamp(p[k] + gauss() * 3, 15, 97); });   // a little different every dynasty
  var pb = TAGMAP.pri[tg.persona];
  p.pri = pb ? randPri(pb) : h.pri ? Object.assign({}, h.pri) : randPri(d.acc.mvp + d.acc.as1 >= 2 ? {win:.08} : null);
  if (has("unselfish")){ p.pri.money = Math.max(.05, p.pri.money - .08); }
  p.persona = DY.personaLabel(p.pri);
  p.style = tg.style || (RT && RT.style) || (p.entry >= 72 ? "Aggressive" : p.entry >= 62 ? "Fast-paced" : p.entry <= 36 ? "Slow / anchor" : at.obj >= 82 && p.role === "SMG" ? "Objective player" : "Balanced");
  p.tier = tg.tier || null;
  p.flags = fl.slice();
  p.rep = d.acc.mvp * 3 + d.acc.as1 * 1.5 + d.acc.as2 + d.acc.champ * 1.2;
  p.realLine = {seasons:d.seasons, first:d.first, last:d.last, kd:d.kd, m:d.m, hp:d.hp, snd:d.snd, ctl:d.ctl, ip:d.ip, obj:d.obj, war10:d.war10, acc:d.acc, maps:d.maps};
  p.maps = DY.mapAffinity(d);
  p.potG = DY.gradeFor(ceil0 + gauss() * (p.age <= 23 ? 2.5 : 1));
  DY.fillTraits(p);
  return p;
};
// map preferences from real Season 5-6 map-by-map K/D (vs his own mode K/D), shrunk for small samples
DY.mapAffinity = function(d){
  var out = {}, md = {HP:d.hp, SND:d.snd, CTL:d.ctl};
  Object.keys(d.maps || {}).forEach(function(k){ var v = d.maps[k], mode = k.split("|")[0], n = v[2] + v[3], base = md[mode] || d.kd; if (!base || !v[1]) return;
    var r = (v[0] / v[1]) / base, wr = v[2] / n; var a = clamp(((r - 1) * 9 + (wr - 0.5) * 3) * n / (n + 4), -3, 3); if (Math.abs(a) >= 0.4) out[k] = Math.round(a * 10) / 10; });
  return out;
};
DY.mapAff = function(p, mode, map){ return (p.maps && p.maps[mode + "|" + map]) || 0; };
DY.baseP = baseP;
DY.norms = function(data){
  var out = {fit:{}, ratio:{}, obj:{AR:{hill:52, hsd:18}, SMG:{hill:68, hsd:18}, pd:[0.85, 0.45], ok:[15.5, 3]}};
  var msd = function(v, d0){ if (v.length < 4) return d0; var mu = mean(v), sd = Math.sqrt(mean(v.map(function(x){ return (x - mu) * (x - mu); }))); return [mu, Math.max(sd, d0[1] * 0.5)]; };
  var od = data.filter(function(d){ return d.obj; });
  out.obj.pd = msd(od.filter(function(d){ return d.obj.pl != null && d.obj.plN >= 4; }).map(function(d){ return d.obj.pl + 2 * (d.obj.df || 0); }), out.obj.pd);
  out.obj.ok = msd(od.filter(function(d){ return d.obj.ok != null && d.obj.okN >= 4; }).map(function(d){ return d.obj.ok; }), out.obj.ok);
  ["AR", "SMG"].forEach(function(r){
    var xs = data.filter(function(d){ return d.r === r && d.m >= 20; }), mx = mean(xs.map(function(d){ return d.ovr; })), my = mean(xs.map(function(d){ return d.kd; }));
    var b = sum(xs.map(function(d){ return (d.ovr - mx) * (d.kd - my); })) / Math.max(1e-6, sum(xs.map(function(d){ return (d.ovr - mx) * (d.ovr - mx); })));
    out.fit[r] = {a:my - b * mx, b:b};
    var hs = data.filter(function(d){ return d.r === r && d.obj && d.obj.hill != null && d.obj.hillN >= 4; }).map(function(d){ return d.obj.hill; }); if (hs.length >= 3){ var hm = msd(hs, [out.obj[r].hill, 18]); out.obj[r].hill = hm[0]; out.obj[r].hsd = hm[1]; }
  });
  ["hp", "snd", "ctl"].forEach(function(k){ var rs = data.filter(function(d){ return d.m >= 20 && d[k] != null && d.kd; }).map(function(d){ return d[k] / d.kd; }), mu = mean(rs); out.ratio[k] = [mu, Math.sqrt(mean(rs.map(function(x){ return (x - mu) * (x - mu); }))) || 0.08]; });
  return out;
};
DY.fitKd = DY.norms;

/* ---------------- gamertag generator for rookies ---------------- */
/* Rookie gamertags: built from fragments of BTL names and pro Call of Duty (CDL / CWL) tags, mixed with
   gamer styling. A generated tag is never an exact real name. */
var PRO = ["Scump","Crimsix","Formal","Clayster","Karma","Simp","aBeZy","Cellium","Shotzzy","Dashy","iLLeY","Pred","Kenny","Arcitys","Octane","Envoy","Hydra","Ghosty","Huke","Attach","Apathy","Skyz","Insight","Kismet","Drazah","Pentagrxm","Abuzah","Sib","Nero","Standy","Asim","Bance","Owakening","Gunless","Methodz","Censor","Nadeshot","Teepee","ProoFy","Accuracy","Zoomaa","Parasite","Rated","Silly","Fero","Vivid","Hollow","Priestahh","Assault","Neptune","Cammy","Afro","Gismo","Slasher","Classic","JKap","Aches","TeeP","Rambo","Sharp","Proto","Temp","Remy","Theory","Zer0","Lucky","Felo","Breszy","Exceed","Nastie","Spart","Zed","Mack","Bance","Venom","Clay","Phantomz","Ghosty","Seany","Diamondcon","Flames","Mosh","Vengeance","Joee","Jurd","Royalty","Kremp","Hicksy","Envy","Sukry","Brack","Lqgend","Nero","Beans","Cleanx","Estreal","Kremp","Mercules","Pentagrxm","Scrap","SlasheR","Spart","Vortex","Wartex","Wuskin","Zaptius","Gunless","Rhino","Kenny","Pred","Stainville","Skrapz","Bance","Peatie","Joshh","Rated","Dylan","CleanX"];
var NAME_STYLE = [["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["i", ""], ["x", ""], ["", "x"], ["", "z"], ["", "y"], ["", "zz"], ["", "TV"], ["", "7"], ["", "GG"], ["", "Jr"]];
var BAD = /(fag|nig|nazi|rape|cunt|shit|fuck|slut|whore|kkk|cum|anal|sex|dick|cock|tits)/i;
var nameParts = null, realNames = null;
function buildParts(){
  var src = PRO.slice(); try { (root.DYN_DATA && root.DYN_DATA.players || []).forEach(function(d){ src.push(d.n); }); } catch (e){}
  if (G && G.P) Object.keys(G.P).forEach(function(k){ if (G.P[k].real) src.push(G.P[k].n); });
  realNames = {}; src.forEach(function(n){ realNames[n.toLowerCase().replace(/[^a-z0-9]/g, "")] = 1; });
  var heads = [], tails = [];
  src.forEach(function(n){ var w = n.replace(/[^A-Za-z]/g, ""); if (w.length < 3) return; var l = w.toLowerCase();
    for (var k = 3; k <= Math.min(4, l.length - 1); k++) heads.push(l.slice(0, k)); for (var j = 2; j <= Math.min(3, l.length - 1); j++) tails.push(l.slice(-j)); });
  nameParts = {h:heads, t:tails};
}
DY.makeName = function(taken){
  if (!nameParts) buildParts();
  for (var t = 0; t < 400; t++){
    var h = pick(nameParts.h), tl = pick(nameParts.t), core = h + tl;
    if (core.length < 4 || core.length > 9) continue;
    if (/(.)\1\1/.test(core) || /[^aeiouy]{3}/.test(core) || /[aeiou]{3}/.test(core) || /([aeiou])\1/.test(core) || /h$|hh|q[^u]|[jvwx][^aeiouy]/.test(core) || !/[aeiouy]/.test(core)) continue;
    var st = pick(NAME_STYLE); if (/[xyz]$/.test(core) && /^[xyz]/.test(st[1])) st = ["", ""];
    var n = st[0] + (st[0] ? core.charAt(0).toUpperCase() + core.slice(1) : core.charAt(0).toUpperCase() + core.slice(1)) + st[1];
    if (chance(0.1)) n = n.replace(/o/, "0"); else if (chance(0.06)) n = n.replace(/e/, "3");
    var key = n.toLowerCase().replace(/[^a-z0-9]/g, ""), ck = core.toLowerCase();
    if (realNames[key] || realNames[ck] || BAD.test(n) || taken[n.toLowerCase()]) continue;
    taken[n.toLowerCase()] = 1; return n;
  }
  return "Rookie" + rint(100, 999);
};

/* ---------------- small helpers on state ---------------- */
DY.P = function(id){ return G.P[id]; };
DY.T = function(id){ return G.teams[id]; };
DY.userT = function(){ return G.teams[G.user]; };
DY.active = function(){ return Object.keys(G.P).map(function(k){ return G.P[k]; }).filter(function(p){ return p.status !== "retired" && p.status !== "prospect"; }); };
DY.prospects = function(){ return Object.keys(G.P).map(function(k){ return G.P[k]; }).filter(function(p){ return p.status === "prospect"; }).sort(function(a, b){ return a.rookie.rank - b.rookie.rank; }); };
DY.allP = function(){ return Object.keys(G.P).map(function(k){ return G.P[k]; }); };
DY.payroll = function(t){ return sum(t.roster.map(function(id){ var c = G.P[id].con; return c ? c.sal : 0; })) + (G.phase === "offseason" ? (t.deadNext || 0) : (t.dead || 0)) + (DY.SCOUT ? DY.SCOUT[t.scout || 0].c : 0); };
DY.spendLimit = function(t){ return (DY.SALARY_CAP ? Math.min(t.budget, DY.SALARY_CAP) : t.budget) + (t.cashAdj || 0); };
DY.space = function(t){ return DY.spendLimit(t) - DY.payroll(t); };
DY.ovrR = function(p){ return Math.round(p.ovr); };
DY.hiddenOvr = function(p){ return !!(p.rookie && p.rookie.hidden); };
DY.addLog = function(p, text){ p.log.unshift({s:G.season, w:G.phase === "offseason" ? "Off" : "W" + G.week, t:text}); if (p.log.length > 40) p.log.length = 40; };
DY.tx = function(text, tids){ G.tx.unshift({s:G.season, w:G.phase === "offseason" ? "Offseason wk " + (G.off ? G.off.week : 0) : G.phase === "playoffs" ? "Playoffs" : "Week " + G.week, t:text, tids:tids || []}); if (G.tx.length > 400) G.tx.length = 400; };
DY.teamOf = function(p){ return p.team != null ? G.teams[p.team] : null; };
DY.abbr = function(tid){ return tid == null ? "FA" : G.teams[tid].abbr; };
DY.statusText = function(p){
  if (p.status === "retired") return "Retired";
  if (p.team != null) return G.teams[p.team].name;
  var mi = p.minor != null && G.minors[p.minor] ? G.minors[p.minor].name : "NONE";
  return "Free Agent · Academy: " + mi;
};
})(typeof window !== "undefined" ? window : globalThis);
