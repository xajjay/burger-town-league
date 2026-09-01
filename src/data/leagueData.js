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
// Player weapon-class role (AR or SMG), shown as a badge on player cards and tables
export const playerRoles = {
  "Hype": "AR",
  "Ephrisy": "AR",
  "Aj": "SMG",
  "Renicide": "SMG",
  "Acro Ace": "AR",
  "CrazieViews": "AR",
  "Jmetree": "AR",
  "Inkster": "AR",
  "Aurora": "SMG",
  "Nastyy": "SMG",
  "Crooked": "SMG",
  "Waly": "AR",
  "Purp": "AR",
  "Proxzify": "AR",
  "Utopian": "SMG",
  "Starry": "SMG",
  "Kai": "AR",
  "Habibi": "SMG",
  "Lurkens": "AR",
  "Lewy": "AR",
  "Karnij": "AR",
  "EJ": "SMG",
  "DessieLoso": "SMG",
  "Thermo": "SMG",
  "Collision": "AR",
  "Bubbles": "AR",
  "Elive": "AR",
  "Pablo": "SMG",
  "Josh": "AR",
  "Nuance": "AR",
  "Godofwarfare": "SMG",
  "Nej": "AR",
  "Casperfy": "AR",
  "Boogey": "AR",
  "Lazyy": "AR",
  "Skapun": "SMG",
  "Dez": "AR",
  "AimKun": "SMG",
  "Docsukii": "AR",
  "Hums": "AR",
  "Andrix": "SMG",
  "MVP": "SMG",
  "Iconz": "SMG",
  "Toremeant": "AR",
  "Mayan": "AR",
  "NickBoston": "AR",
  "Leib": "SMG",
  "Nada": "AR",
  "Grihmey": "AR",
  "Tubby": "SMG",
  "Duffie": "SMG",
  "Deceptions": "SMG",
  "Phanatic": "SMG",
  "TrapEU": "SMG",
  "JayDash": "AR",
  "Zirow": "AR",
  "Jealous": "AR",
  "Hazier": "SMG",
  "Dragon": "AR",
  "Kfrankess": "AR",
  "Noti": "SMG",
  "Dayz": "SMG",
  "Python": "SMG",
  "Xylow": "AR",
  "Bleepa": "AR",
  "Kugo": "AR",
  "Angelina": "AR",
  "Freak": "AR",
  "Killfeed": "AR",
  "Kelp": "SMG",
  "Luvfern": "AR",
  "Nacho": "AR",
  "Wrihs": "SMG",
  "Roll": "AR",
  "Mythycall": "AR",
  "NickyB": "AR",
  "User": "SMG",
  "Horror": "AR",
  "Edot": "SMG",
  "AGF": "AR",
  "Underwrld": "AR",
  "LT7": "AR",
  "Sergio": "SMG",
  "IBO": "AR",
  "Shadow": "AR",
  "Stunless": "SMG",
  "Anura": "AR",
  "Ryanreplays": "AR",
  "Verb": "AR",
  "Avecti": "AR",
  "Seno": "SMG",
  "Stim": "SMG",
  "Kirchy": "SMG",
  "Dreamy": "AR",
  "Trap": "SMG",
  "Hyper": "AR",
  "Peach": "AR",
  "Soup": "AR",
  "AlexthekillahH": "SMG",
  "Chemwreck": "AR",
  "Realm": "SMG",
  "Cold": "AR",
  "Scare": "AR",
  "Luke B": "SMG",
  "Cholo": "AR",
  "Sybil": "SMG",
  "Bebo": "AR",
  "i2Dreamy": "AR",
  "Zylix": "SMG",
  "Snapple": "AR",
  "2fly": "AR",
  "Secret": "AR",
  "Robi": "SMG",
  "Zico": "AR",
  "Jumpz": "AR",
  "Tonychickenparm": "AR",
  "Kelpmeltz": "SMG",
  "Versaii": "AR",
  "huxx": "SMG",
  "Grimzey": "AR",
  "Shasta": "AR",
  "Kael": "SMG",
  "Jah": "AR",
  "N8DOGG": "AR",
  "Chadwick": "SMG",
  "Aldo": "SMG",
};
export function getPlayerRole(name) {
  return playerRoles[name] || null;
}

export const playerPhotos = {
  'aj': '/images/players/aj.jpg',
  'renicide': '/images/players/renicide.png',
  'lewy': '/images/players/lewy.jpg',
  'waly': '/images/players/waly.jpg',
  'jmetree': '/images/players/jmetree.jpg',
  'nastyy': '/images/players/nastyy.jpg',
  'aurora': '/images/players/aurora.jpg',
  'crazieviews': '/images/players/crazieviews.jpg',
  'shadow': '/images/players/shadow.jpg',
  'acroace': '/images/players/acroace.jpg',
};
export function getPlayerPhoto(name) {
  return playerPhotos[norm(name)] || null;
}

const championBySeason = Object.fromEntries(raw.champions.map(c => [c.season, c]));
const mvpBySeason = Object.fromEntries(raw.mvps.map(m => [m.season, resolveName(m.mvp)]));

const REMOVED_PLAYERS = new Set(['anura']); // left the league; excluded entirely per request

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
    data.players
      .filter(p => !(p.kd === 0 && p.kills === 0 && p.deaths === 0))
      .filter(p => !REMOVED_PLAYERS.has(norm(p.player)))
      .map(p => ({
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
        honors: [...p.honors],
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
      runnerUp: s.runnerUp || false,
      officialFinish: s.officialFinish || '',
      record: s.record,
      winPct: s.winPct || null,
      mapRecord: s.mapRecord || null,
      roster: s.roster || [],
    })),
  ])
);

export const seasonRecords = raw.seasonRecords || {};

// All-Time Records — the best (or, for "...Low" categories, worst/lowest) value
// per category+mode across every season's Season Records table.
export const allTimeRecords = (() => {
  const categories = {};
  for (const [sid, groups] of Object.entries(seasonRecords)) {
    for (const g of groups) {
      const cat = (categories[g.category] ||= { category: g.category, modes: {} });
      const isLow = /Low$/.test(g.category);
      for (const [mode, data] of Object.entries(g.modes)) {
        if (!data || data.value == null) continue;
        const current = cat.modes[mode];
        const better = !current || (isLow ? data.value < current.value : data.value > current.value);
        if (better) {
          cat.modes[mode] = { holder: data.holder, value: data.value, season: sid };
        }
      }
    }
  }
  return Object.values(categories);
})();

export const careerStats = raw.career
  .filter(c => !(c.kd === 0 && c.kills === 0 && c.deaths === 0))
  .filter(c => !REMOVED_PLAYERS.has(norm(c.player)))
  .map(c => ({
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
  season: s.season || 5,
  name: s.name,
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

// "Super Burger" — a tongue-in-cheek honor for whoever has the LOWEST Overall in each season.
// Injected directly into that season's honors + the player's per-season honors map.
for (const [sid, players] of Object.entries(seasonStats)) {
  const withOverall = players.filter(p => p.overall != null);
  if (!withOverall.length) continue;
  const minOverall = Math.min(...withOverall.map(p => p.overall));
  for (const p of withOverall) {
    if (p.overall !== minOverall) continue;
    p.honors.push('Super Burger');
    (perPlayerSeasonHonors[p.player] ||= {});
    const existing = perPlayerSeasonHonors[p.player][sid] || [];
    if (!existing.includes('Super Burger')) {
      perPlayerSeasonHonors[p.player][sid] = [...existing, 'Super Burger'];
    }
  }
}

export function hasSuperBurger(name) {
  const bySeason = perPlayerSeasonHonors[name] || {};
  return Object.values(bySeason).some(h => h.includes('Super Burger'));
}
function getSuperBurgerSeasons(name) {
  const bySeason = perPlayerSeasonHonors[name] || {};
  return Object.entries(bySeason).filter(([, h]) => h.includes('Super Burger')).map(([s]) => s);
}

// G.O.A.T. badge — whoever sits at Hall of Fame rank #1
export const goatPlayer = hallOfFame.find(h => h.rank === 1)?.player || null;

export const tournamentWinners = [
  {
    name: '4v4 Cold War Variant (2024)',
    team: 'Night City',
    players: ['Ephrisy', 'Crooked', 'Renicide', 'Aj'],
  },
  {
    name: '4v4 Variant Draft Tournament (2024)',
    team: 'WCi',
    players: ['Nastyy', 'Gunstahh', 'Bubbles', 'MVP'],
  },
];

function isTournamentWinner(name) {
  return tournamentWinners.some(t => t.players.some(p => p.toLowerCase() === (name || '').toLowerCase()));
}

export function getSpecialBadges(name) {
  const badges = [];
  if (name === goatPlayer) badges.push({ type: 'goat', label: 'G.O.A.T.' });
  if (isHofPlayer(name)) badges.push({ type: 'hof', label: 'Hall of Fame' });
  if (hasSuperBurger(name)) {
    const seasonsList = getSuperBurgerSeasons(name);
    badges.push({ type: 'superburger', label: `Super Burger (${seasonsList.map(s => `S${s}`).join(', ')})` });
  }
  if (isTournamentWinner(name)) badges.push({ type: 'tournament', label: 'Tournament Winner' });
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
