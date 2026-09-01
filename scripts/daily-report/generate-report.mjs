// Burger Town Leagues — Daily Report Bot
//
// Run by GitHub Actions once a day (or manually with a specific topic).
// Picks a "today's angle" from the league's real stats/history data, asks
// Claude to write it up like a sports media desk, and posts the result to
// Discord via webhook.
//
// Required environment variables (set as GitHub repo secrets):
//   ANTHROPIC_API_KEY   - from console.anthropic.com
//   DISCORD_WEBHOOK_URL - from Discord channel settings > Integrations > Webhooks
//
// Optional environment variable:
//   MANUAL_TOPIC        - set when manually triggered with a specific topic

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Your existing secret — the #league-news webhook. This one gets the role ping.
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// New, optional — a second webhook (e.g. #general) that gets the same report
// posted to it, without a role ping (so people in both channels aren't pinged twice).
const DISCORD_WEBHOOK_URL_GENERAL = process.env.DISCORD_WEBHOOK_URL_GENERAL;
const DISCORD_ROLE_ID = process.env.DISCORD_ROLE_ID; // optional — pings this role if set

if (!ANTHROPIC_API_KEY || !DISCORD_WEBHOOK_URL) {
  console.error('Missing ANTHROPIC_API_KEY or DISCORD_WEBHOOK_URL environment variable.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// "Queue for next scheduled run" — if someone manually triggers this with a
// topic AND checks the queue box, we save the topic to a file and stop, WITHOUT
// posting anything. The next run (typically tonight's automatic scheduled run)
// will pick it up, use it, then clear it and go back to normal random picks.
// ---------------------------------------------------------------------------
const NEXT_TOPIC_PATH = join(__dirname, 'next-topic.txt');
const QUEUE_FOR_NEXT_RUN = (process.env.QUEUE_FOR_NEXT_RUN || '').trim().toLowerCase() === 'true';
const RAW_MANUAL_TOPIC = (process.env.MANUAL_TOPIC || '').trim();

if (RAW_MANUAL_TOPIC && QUEUE_FOR_NEXT_RUN) {
  writeFileSync(NEXT_TOPIC_PATH, RAW_MANUAL_TOPIC + '\n');
  console.log('Queued topic for the next scheduled run (nothing posted this time):', RAW_MANUAL_TOPIC);
  process.exit(0);
}

// A topic queued by an earlier run, waiting to be used — empty string if none.
const queuedTopic = existsSync(NEXT_TOPIC_PATH) ? readFileSync(NEXT_TOPIC_PATH, 'utf-8').trim() : '';
let usedQueuedTopic = false;

// ---------------------------------------------------------------------------
// Load league data
// ---------------------------------------------------------------------------
const data = JSON.parse(readFileSync(join(__dirname, '../../src/data/real_data.json'), 'utf-8'));
const storylinesFile = JSON.parse(readFileSync(join(__dirname, 'storylines.json'), 'utf-8'));
const storylines = storylinesFile.storylines || [];
const playerNotes = storylinesFile.playerNotes || [];
const upcomingSeason = JSON.parse(readFileSync(join(__dirname, 'upcoming-signups.json'), 'utf-8'));
const playerRoles = JSON.parse(readFileSync(join(__dirname, 'player-roles.json'), 'utf-8'));

const HISTORY_PATH = join(__dirname, 'history.json');
const HISTORY_LIMIT = 20; // how many past picks we remember, to avoid repeats
const history = existsSync(HISTORY_PATH)
  ? JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')).recent || []
  : [];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick from arr, preferring items whose id hasn't shown up in recent history
// under the given angle. Falls back to the full list if everything's recent.
function pickFresh(arr, angle, idFn) {
  const recentIds = new Set(
    history.filter(h => h.angle === angle).map(h => h.subject)
  );
  const fresh = arr.filter(x => !recentIds.has(idFn(x)));
  return pick(fresh.length > 0 ? fresh : arr);
}

// ---------------------------------------------------------------------------
// Derived data for the newer angles
// ---------------------------------------------------------------------------

// Every player-season row across all 5 seasons, for a "best seasons ever" leaderboard
const allSeasonRows = [];
for (const sid of ['1', '2', '3', '4', '5']) {
  for (const p of data.seasons[sid].players) {
    if (p.overall != null) {
      allSeasonRows.push({ season: sid, player: p.player, team: p.team, overall: p.overall, kd: p.kd, kills: p.kills, deaths: p.deaths, maps: p.maps, honors: p.honors });
    }
  }
}
const bestIndividualSeasons = [...allSeasonRows].sort((a, b) => b.overall - a.overall).slice(0, 15);

// Players with a strong Overall but no honors of any kind — "underrated" candidates
const honorsByPlayer = data.perPlayerSeasonHonors || {};
function totalHonorCount(playerName) {
  const bySeason = honorsByPlayer[playerName] || {};
  return Object.values(bySeason).reduce((sum, arr) => sum + arr.length, 0);
}
const underratedCandidates = data.career
  .filter(c => c.playerOverall != null && c.playerOverall >= 82 && totalHonorCount(c.player) === 0)
  .sort((a, b) => b.playerOverall - a.playerOverall);

// Award-chase angles: close to Hall of Fame eligibility, chasing a first ring,
// or chasing the #1 Legacy spot
const oneSeasonFromHOF = data.career.filter(c => c.numQualifyingSeasons === 2);
const allStarsNoRing = data.hallOfFame.filter(h => (h.allStar1 + h.allStar2) >= 3 && h.championships === 0);
const chasingGoat = data.hallOfFame.slice(1, 5); // ranks 2-5, chasing rank 1

// All-time team dominance: best regular-season records/win% across seasons with
// reliable series data (Season 2 lacks series win%, so it's excluded from this ranking)
const allTimeTeamRecords = [];
for (const sid of ['1', '3', '4', '5']) {
  for (const s of data.seasons[sid].standings) {
    if (s.winPct) {
      allTimeTeamRecords.push({ season: sid, team: s.team, record: s.record, winPct: s.winPct, champion: s.champion });
    }
  }
}
allTimeTeamRecords.sort((a, b) => parseInt(b.winPct) - parseInt(a.winPct));
const topAllTimeTeams = allTimeTeamRecords.slice(0, 10);

// Raw real_data.json career entries store per-season K/D as an object keyed by
// season id (seasonKD), not a "seasons" array — that array is only derived on
// the website's JS layer. Derive it here the same way.
function seasonCount(careerEntry) {
  return Object.keys(careerEntry.seasonKD || {}).length;
}

// Top players by weapon-class role, ranked by career Overall (min 2 seasons
// played so one-off cameo stats don't skew the list)
function topByRole(role) {
  return data.career
    .filter(c => playerRoles[c.player] === role && c.playerOverall != null && seasonCount(c) >= 2)
    .sort((a, b) => b.playerOverall - a.playerOverall)
    .slice(0, 10)
    .map(c => ({ player: c.player, role, overall: c.playerOverall, kd: c.kd, seasons: seasonCount(c) }));
}
const topARPlayers = topByRole('AR');
const topSMGPlayers = topByRole('SMG');

// Top 10 by pure career K/D (minimum sample size so small cameo stats don't dominate)
const topKdAllTime = [...data.career]
  .filter(c => c.maps >= 30)
  .sort((a, b) => b.kd - a.kd)
  .slice(0, 10)
  .map(c => ({ player: c.player, kd: c.kd, maps: c.maps, seasons: seasonCount(c) }));

// A brief (title-only) storyline callback for flavor, if one exists for a given player —
// used as a passing mention, never the main subject of a post
function storylineFlavorFor(playerName) {
  const match = storylines.find(s => (s.players || []).some(p => p.toLowerCase() === playerName.toLowerCase()));
  return match ? { title: match.title, oneLiner: match.summary.split('.')[0] + '.' } : null;
}

// ---------------------------------------------------------------------------
// Topic override — either a direct manual topic this run, or a queued one
// left over from an earlier "queue for next run" request. Direct manual
// topics always take priority if somehow both are present.
// ---------------------------------------------------------------------------
const effectiveTopic = RAW_MANUAL_TOPIC || queuedTopic;
if (!RAW_MANUAL_TOPIC && queuedTopic) {
  usedQueuedTopic = true;
  console.log('Using queued topic from a previous request:', queuedTopic);
}

let context;
let angle;
let subjectId = null;

if (effectiveTopic) {
  angle = 'manual_topic';
  context = {
    angle,
    requestedTopic: effectiveTopic,
    hallOfFameTop10: data.hallOfFame.slice(0, 10),
    champions: data.champions,
    mvps: data.mvps,
    storylinesForReferenceOnly: storylines,
    playerNotes,
    careerLeaders: [...data.career].sort((a, b) => (b.playerOverall ?? 0) - (a.playerOverall ?? 0)).slice(0, 20),
  };
} else {
  // The current season (BTL Season 1) hasn't started yet, so this runs in
  // "offseason" mode — mostly retrospective and preview content, the way real
  // sports media covers an offseason. Flip hasLiveSeason once real matches exist.
  const hasLiveSeason = false;

  const angles = hasLiveSeason
    ? ['match_recap', 'upcoming_schedule', 'power_rankings', 'player_spotlight', 'top10_ar', 'top10_smg']
    : [
        'player_spotlight', 'power_rankings_alltime', 'season_preview', 'awards_chase',
        'all_time_teams', 'underrated_players', 'best_individual_seasons',
        'top10_ar', 'top10_smg', 'top10_kd_alltime',
      ];

  // Avoid repeating the exact same angle as the last run
  const lastAngle = history.length > 0 ? history[history.length - 1].angle : null;
  const angleChoices = angles.filter(a => a !== lastAngle);
  angle = pick(angleChoices.length > 0 ? angleChoices : angles);
  context = { angle };

  if (angle === 'player_spotlight') {
    const p = pickFresh(data.hallOfFame.slice(0, 15), angle, x => x.player);
    const career = data.career.find(c => c.player === p.player);
    const note = playerNotes.find(n => n.player.toLowerCase() === p.player.toLowerCase());
    const flavor = storylineFlavorFor(p.player);
    context.player = p;
    context.career = career;
    context.role = playerRoles[p.player] || null;
    if (note) context.playerNote = note;
    if (flavor) context.briefHistoricalFlavor = flavor; // mention only in passing, not the main story
    subjectId = p.player;
  } else if (angle === 'power_rankings_alltime') {
    context.top10 = data.hallOfFame.slice(0, 10);
  } else if (angle === 'season_preview') {
    const allNames = upcomingSeason.teams.flatMap(t => [t.captain, ...t.players]);
    context.finalTeams = upcomingSeason.teams;
    context.notablePlayers = allNames
      .map(name => data.career.find(c => c.player.toLowerCase() === name.toLowerCase())) }
   