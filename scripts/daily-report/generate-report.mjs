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
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_ROLE_ID = process.env.DISCORD_ROLE_ID; // optional — pings this role if set

if (!ANTHROPIC_API_KEY || !DISCORD_WEBHOOK_URL) {
  console.error('Missing ANTHROPIC_API_KEY or DISCORD_WEBHOOK_URL environment variable.');
  process.exit(1);
}

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
// Manual topic override — if someone runs this by hand from the Actions tab
// and fills in a topic, skip the random angle and report on that instead.
// ---------------------------------------------------------------------------
const MANUAL_TOPIC = (process.env.MANUAL_TOPIC || '').trim();

let context;
let angle;
let subjectId = null;

if (MANUAL_TOPIC) {
  angle = 'manual_topic';
  context = {
    angle,
    requestedTopic: MANUAL_TOPIC,
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
    context.upcomingSeason = upcomingSeason;
    context.notablePlayers = upcomingSeason.players
      .map(name => data.career.find(c => c.player === name))
      .filter(Boolean)
      .sort((a, b) => (b.playerOverall ?? 0) - (a.playerOverall ?? 0))
      .slice(0, 10);
  } else if (angle === 'awards_chase') {
    context.oneSeasonFromHOF = oneSeasonFromHOF;
    context.allStarsChasingFirstRing = allStarsNoRing;
    context.chasingTheGoat = chasingGoat;
    context.currentGoat = data.hallOfFame[0];
  } else if (angle === 'all_time_teams') {
    context.topAllTimeTeams = topAllTimeTeams;
    context.champions = data.champions;
  } else if (angle === 'underrated_players') {
    context.candidates = underratedCandidates.slice(0, 12);
  } else if (angle === 'best_individual_seasons') {
    context.leaderboard = bestIndividualSeasons;
  } else if (angle === 'top10_ar') {
    context.top10 = topARPlayers;
  } else if (angle === 'top10_smg') {
    context.top10 = topSMGPlayers;
  } else if (angle === 'top10_kd_alltime') {
    context.top10 = topKdAllTime;
  }
}

// ---------------------------------------------------------------------------
// Build the prompt
// ---------------------------------------------------------------------------
const systemPrompt = `You are Stephen A. Sizzle, the official beat reporter for Burger Town Leagues (BTL), a competitive Call of Duty: Black Ops Cold War draft league. Your job is to write a short daily post for the league's Discord channel. Your name is a nod to sports media's bigger personalities, but don't overplay it — no need to reference your own name or lean into shtick, just let a little personality show through naturally in the writing.

Voice: think real sports media — ESPN, The Athletic, an esports desk. Vary your energy: sometimes a punchy, entertaining take (bold rankings, hot takes on a top 10 list), sometimes calmer and more analytical (stat breakdowns, objective rankings). Never force the hype — confident and a little playful is good, try-hard is not. Use real names and real numbers from the data given. You may draw your own original observations and connections from the stats provided (a quiet streak, an underappreciated pattern, a fair comparison between eras) as long as they're genuinely supported by the numbers you were given — never invent stats, records, or events that aren't in the data.

Editorial direction: favor forward-looking content — season previews, players to watch, power rankings, top-10 lists by role or stat, award-chase storylines, "greatest ever" debates. When history comes up, use it the way sports media uses records and legacy (a player's résumé, a team's dominant stretch, a rivalry in stats) rather than retelling old drama as the headline. If a "briefHistoricalFlavor" field is present, you may drop it in as a single passing line for color — do not make it the focus of the piece.

The league's upcoming season hasn't started yet, so lean into offseason-style formats: top-10 lists (by role, by stat, by era), "players to watch this season," "the case for X as the greatest Y ever," award-chase storylines. Ranked lists are a great default format here.

Format: a punchy one-line headline, then 2-3 short paragraphs (120-220 words total). No markdown headers, just plain text with the headline as the first line.

If the data includes a "requestedTopic" field, someone specifically asked for a report on that exact topic — write about that topic specifically, using the reference data provided to find real supporting facts. If the topic doesn't clearly match anything in the reference data, write the best honest piece you can and don't invent specifics you can't support.`;

const userPrompt = `Write today's report. Here is the data to base it on:\n\n${JSON.stringify(context, null, 2)}`;

// ---------------------------------------------------------------------------
// Call Claude
// ---------------------------------------------------------------------------
async function generateReport() {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const block = json.content.find(b => b.type === 'text');
  return block ? block.text.trim() : null;
}

// ---------------------------------------------------------------------------
// Post to Discord
// ---------------------------------------------------------------------------
async function postToDiscord(reportText) {
  const lines = reportText.split('\n').filter(Boolean);
  const headline = lines[0];
  const body = lines.slice(1).join('\n\n');

  const payload = {
    username: 'Stephen A. Sizzle',
    avatar_url: 'https://burgertownleagues.com/images/burger-icon.png',
    embeds: [
      {
        title: headline.slice(0, 256),
        description: body.slice(0, 4000),
        color: 0xe2231a,
        footer: { text: 'Burger Town Leagues' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // A role mention only pings if it's in the top-level "content" field (embeds
  // never ping), and only if allowed_mentions explicitly permits that role.
  if (DISCORD_ROLE_ID) {
    payload.content = `<@&${DISCORD_ROLE_ID}>`;
    payload.allowed_mentions = { roles: [DISCORD_ROLE_ID] };
  }

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Update history (skipped for manual-topic runs, since those aren't part of
// the "avoid repeats" rotation)
// ---------------------------------------------------------------------------
function updateHistory() {
  if (MANUAL_TOPIC) return;
  const entry = { date: new Date().toISOString().slice(0, 10), angle, subject: subjectId };
  const updated = [...history, entry].slice(-HISTORY_LIMIT);
  writeFileSync(HISTORY_PATH, JSON.stringify({ recent: updated }, null, 2));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
try {
  console.log('Today\'s angle:', angle, subjectId ? `(${subjectId})` : '');
  const report = await generateReport();
  console.log('Generated report:\n', report);
  await postToDiscord(report);
  updateHistory();
  console.log('Posted to Discord successfully.');
} catch (err) {
  console.error('Failed to generate/post report:', err);
  process.exit(1);
}
