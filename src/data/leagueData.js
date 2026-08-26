import raw from './real_data.json';

export const foundedYear = 2024;

export const homeDescription = "Burger Town is the new home for Cold War Draft Leagues and Call of Duty tournaments. Built for an established competitive community, BTL brings a new league experience while preserving the history players have built across different leagues over the years. Explore historical records, player statistics, standings, and everything leading into the next chapter of Cold War Draft League competition.";

export const social = {
  youtube: "https://www.youtube.com/@BurgerTownLeagues",
  discord: "https://discord.gg/G2kdxeGkZ",
  twitter: "https://x.com/burgrtown",
  email: "burgertownleagues@gmail.com",
};

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
const aliasMap = raw.aliasMap || {};
function resolveName(name) {
  return aliasMap[norm(name)] || name;
}

const championBySeason = Object.fromEntries(raw.champions.map(c => [c.season, c]));
const mvpBySeason = Object.fromEntries(raw.mvps.map(m => [m.season, resolveName(m.mvp)]));

export const seasons = ['1', '2', '3', '4', '5'].map(sid => ({
  id: Number(sid),
  name: `Season ${sid}`,
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

export const careerStats = raw.career.map(c => ({
  player: c.player,
  seasons: Object.keys(c.seasonKD).map(Number).sort((a, b) => a - b),
  seasonKD: c.seasonKD,
  kills: c.kills,
  deaths: c.deaths,
  kd: c.kd,
  maps: c.maps,
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

export function findPlayer(name) {
  return careerStats.find(p => p.player.toLowerCase() === decodeURIComponent(name).toLowerCase());
}

export function isKnownPlayer(name) {
  return careerStats.some(p => p.player.toLowerCase() === (name || '').toLowerCase());
}
