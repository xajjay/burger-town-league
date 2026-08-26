import raw from './real_data.json';

export const foundedYear = 2024;

export const homeDescription = "Burger Town is the new home for Cold War Draft Leagues and Call of Duty tournaments. Built for an established competitive community, BTL brings a new league experience while preserving the history players have built across different leagues over the years. Explore historical records, player statistics, standings, and everything leading into the next chapter of Cold War Draft League competition.";

export const social = {
  youtube: "https://www.youtube.com/@BurgerTownLeagues",
  discord: "https://discord.gg/G2kdxeGkZ",
  twitter: "https://x.com/burgrtown",
  email: "burgertownleagues@gmail.com",
};

export const signupFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSd7tkxczxplrqFmBzXphCzQNQWONYlR2EXZDfsj4YzTcbUsFQ/viewform?pli=1&pli=1";
export const rulebookUrl = "https://docs.google.com/document/d/1yFZNfyt_Fgq2tdFr63N2HR-z9iS_tohesAoDdQuprwM/edit?tab=t.0";

export const seasonYears = { 1: 2023, 2: 2023, 3: 2024, 4: 2024, 5: 2026 };
export const upcomingSeasonLabel = "BTL Season 1";
export const upcomingSeasonYear = 2026;

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
const aliasMap = raw.aliasMap || {};
const KNOWN_NAME_FIXES = { ephrishy: 'Ephrisy' };
function resolveName(name) {
  const n = norm(name);
  if (KNOWN_NAME_FIXES[n]) return KNOWN_NAME_FIXES[n];
  return aliasMap[n] || name;
}

// Player profile photos — add an entry here (filename must exist in /public/images/players/)
// to give a player a photo on their card. Players without an entry just show their name.
export const playerPhotos = {
  'aj': '/images/players/aj.jpg',
  'renicide': '/images/players/renicide.png',
  'lewy': '/images/players/lewy.jpg',
};
export function getPlayerPhoto(name) {
  return playerPhotos[norm(name)] || null;
}

const championBySeason = Object.fromEntries(raw.champions.map(c => [c.season, c]));
const mvpBySeason = Object.fromEntries(raw.mvps.map(m => [m.season, resolveName(m.mvp)]));

export const seasons = ['1', '2', '3', '4', '5'].map(sid => ({
  id: Number(sid),
  name: `Season ${sid}`,
  year: seasonYears[Number(sid)],
  league: championBySeason[sid]?.league || '',
  champion: championBySeason[sid]?.team || 'TBD',
  championManager: championBySeason[sid]?.manager || '',
  mvp: mvpBySeason[sid] || 'TBD',
  status: 'Complete',
}));

export const seasonStats = Object.fromEntries(
  Object.entries(raw.seasons).map(([sid, data]) => [
    Number(sid),
    data.players.map(p => ({
      player: p.player,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      kd: p.kd,
      maps: p.maps,
      overall: p.overall,
      hpKd: p.hpKd,
      sndKd: p.sndKd,
      ctlKd: p.ctlKd,
      respawnKd: (p.hpKd != null && p.ctlKd != null) ? (p.hpKd + p.ctlKd) / 2 : null,
      interactionsPerMap: p.interactionsPerMap,
      allStar: p.allStar,
      honors: p.honors,
    })),
  ])
);

export const standings = Object.fromEntries(
  Object.entries(raw.seasons).map(([sid, data]) => [
    Number(sid),
    data.standings.map(s => ({
      rank: s.rank,
      team: s.team,
      manager: s.manager,
      champion: s.champion,
      record: s.record,
    })),
  ])
);

export const seasonRecords = raw.seasonRecords || {};

export const careerStats = raw.career.map(c => ({
  player: c.player,
  seasons: Object.keys(c.seasonKD).map(Number).sort((a, b) => a - b),
  seasonKD: c.seasonKD,
  kills: c.kills,
  deaths: c.deaths,
  kd: c.kd,
  maps: c.maps,
  avgSeasonOverall: c.avgSeasonOverall,
  overall: c.playerOverall,
  accolades: c.accolades,
}));

export const hallOfFame = raw.hallOfFame;

export const allStarsBySeason = raw.allStars;

export const perPlayerSeasonHonors = raw.perPlayerSeasonHonors;

// Series/match-level data — currently only recorded for Season 5
export const seriesList = raw.series.map((s) => ({
  slug: s.slug,
  season: 5,
  name: s.displayName,
  isPlayoff: s.isPlayoff,
  teams: s.teams,
  players: s.players,
}));

export function getAllStarCount(name) {
  const bySeason = perPlayerSeasonHonors[name] || {};
  let count = 0;
  for (const honors of Object.values(bySeason)) {
    for (const h of honors) {
      if (h.includes('All-Star')) count++;
    }
  }
  return count;
}

// "Super Burger" — a tongue-in-cheek honor for whoever has the lowest career Overall rating
const _ranked = careerStats.filter(p => p.overall != null).sort((a, b) => a.overall - b.overall);
export const superBurgerPlayer = _ranked.length ? _ranked[0].player : null;

// G.O.A.T. badge — whoever sits at Hall of Fame rank #1
export const goatPlayer = hallOfFame.find(h => h.rank === 1)?.player || null;

export function getSpecialBadges(name) {
  const badges = [];
  if (name === goatPlayer) badges.push({ type: 'goat', label: 'G.O.A.T.' });
  if (isHofPlayer(name)) badges.push({ type: 'hof', label: 'Hall of Fame' });
  if (name === superBurgerPlayer) badges.push({ type: 'superburger', label: 'Super Burger' });
  return badges;
}

export function findPlayer(name) {
  return careerStats.find(p => p.player.toLowerCase() === decodeURIComponent(name).toLowerCase());
}

export function isKnownPlayer(name) {
  return careerStats.some(p => p.player.toLowerCase() === (name || '').toLowerCase());
}

export function getHofEntry(name) {
  return hallOfFame.find(h => h.player.toLowerCase() === (name || '').toLowerCase()) || null;
}

export function isHofPlayer(name) {
  return getHofEntry(name) !== null;
}
