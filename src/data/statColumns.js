// Column layouts for the season stat tables (season pages + current-season Player Stats).
// Each column: label, value(p) for sorting, show(p) for display, optional gold / title.
// Player, team and honors cells are rendered by the page itself.

const num = (v) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
const fx = (d) => (v) => (num(v) == null ? 'N/A' : v.toFixed(d));
const rnd = (v) => (num(v) == null ? 'N/A' : String(Math.round(v)));
const sndObj = (p) => (num(p.plantsPerSnd) == null && num(p.defusesPerSnd) == null ? null : (p.plantsPerSnd || 0) + (p.defusesPerSnd || 0));

const C = {
  kd: { label: 'K/D', value: (p) => p.kd, show: (p) => fx(2)(p.kd), gold: true },
  maps: { label: 'Maps', value: (p) => p.maps, show: (p) => p.maps ?? 'N/A' },
  series: { label: 'Series Played', value: (p) => p.seriesPlayed, show: (p) => p.seriesPlayed ?? 'N/A' },
  ovr: { label: 'OVR', value: (p) => p.overall, show: (p) => p.overall ?? 'N/A', gold: true, defaultSort: true },
  war: { label: 'WAR', value: (p) => p.war, show: (p) => fx(2)(p.war), title: 'Wins Above Replacement' },
  war10: { label: 'WAR/10', value: (p) => p.war10, show: (p) => fx(2)(p.war10), title: 'WAR per 10 maps' },
  warPlus: { label: 'WAR+', value: (p) => p.warPlus, show: (p) => fx(2)(p.warPlus), title: 'WAR plus objective value' },
  warPlus10: { label: 'WAR+/10', value: (p) => p.warPlus10, show: (p) => fx(2)(p.warPlus10), title: 'WAR+ per 10 maps' },
  ipm: { label: 'Interactions/Map', value: (p) => p.interactionsPerMap, show: (p) => fx(1)(p.interactionsPerMap) },
  hpKd: { label: 'HP K/D', value: (p) => p.hpKd, show: (p) => fx(2)(p.hpKd) },
  hill: { label: 'Hill Time', value: (p) => p.hillPerHp, show: (p) => rnd(p.hillPerHp), title: 'Hill time per Hardpoint map (seconds)' },
  sndKd: { label: 'SnD K/D', value: (p) => p.sndKd, show: (p) => fx(2)(p.sndKd) },
  sndObj: { label: 'SnD Objectives', value: sndObj, show: (p) => fx(2)(sndObj(p)), title: 'Plants + defuses per SnD map' },
  ctlKd: { label: 'Control K/D', value: (p) => p.ctlKd, show: (p) => fx(2)(p.ctlKd) },
  objKills: { label: 'Obj Kills/Control', value: (p) => p.objKillsPerCtl, show: (p) => fx(1)(p.objKillsPerCtl), title: 'Objective kills per Control map' },
};

// Seasons 5+ (objective data exists)
export const objectiveColumns = [C.kd, C.series, C.ovr, C.warPlus, C.warPlus10, C.ipm, C.hpKd, C.hill, C.sndKd, C.sndObj, C.ctlKd, C.objKills];

export function seasonColumns(seasonId) {
  if (seasonId === 1) return [C.kd, C.maps, C.ovr, C.war, C.war10, C.ipm];
  if (seasonId <= 4) return [C.kd, C.series, C.ovr, C.war, C.war10, C.ipm, C.hpKd, C.sndKd, C.ctlKd];
  return objectiveColumns;
}
