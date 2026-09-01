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
      .map(name => data.career.find(c => c.player.toLowerCase() === name.toLowerCase()))
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

Format: a punchy one-line headline, then the body. Keep it well under the length limit so it never gets cut off mid-sentence — budget your words up front rather than running long and trailing off.

For any ranked/Top-10 list: put a blank line between every single entry so it's easy to read as a list, not a wall of text. Keep each entry to one or two sentences — a quick stat, why they're ranked there, done. Do not add, remove, or reorder any names beyond exactly what's given to you in the data's list (e.g. "top10", "candidates", "leaderboard" fields) — those lists are already correctly filtered by role and stats; never include a player who isn't in the given list, even if you think they'd fit.

No markdown headers.

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
      max_tokens: 4096,
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
  if (!block) {
    throw new Error(`Claude response had no text content. Full response: ${JSON.stringify(json)}`);
  }
  return block.text.trim();
}

// ---------------------------------------------------------------------------
// Post to Discord
// ---------------------------------------------------------------------------
async function sendToWebhook(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
}

async function postToDiscord(reportText) {
  const trimmed = reportText.trim();
  const firstNewline = trimmed.indexOf('\n');
  const headline = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline).trim();
  const body = firstNewline === -1 ? '' : trimmed.slice(firstNewline + 1).trim();

  const embed = {
    title: headline.slice(0, 256),
    description: body.slice(0, 4000),
    color: 0xe2231a,
    footer: { text: 'Burger Town Leagues' },
    timestamp: new Date().toISOString(),
  };

  const basePayload = {
    username: 'Stephen A. Sizzle',
    avatar_url: 'https://burgertownleagues.com/images/stephen-a-sizzle.jpg',
    embeds: [embed],
  };

  // Primary channel (#league-news) — gets the role ping, if one is configured.
  const primaryPayload = { ...basePayload };
  if (DISCORD_ROLE_ID) {
    primaryPayload.content = `<@&${DISCORD_ROLE_ID}>`;
    primaryPayload.allowed_mentions = { roles: [DISCORD_ROLE_ID] };
  }

  // Fire both channels at the same time — general (if configured) never gets
  // a role ping, so nobody there is notified, and both posts show up under
  // the same Stephen A. Sizzle name/avatar since they share basePayload.
  const sends = [
    sendToWebhook(DISCORD_WEBHOOK_URL, primaryPayload).then(() =>
      console.log('Posted to primary channel (league-news).')
    ),
  ];
  if (DISCORD_WEBHOOK_URL_GENERAL) {
    sends.push(
      sendToWebhook(DISCORD_WEBHOOK_URL_GENERAL, basePayload).then(() =>
        console.log('Posted to secondary channel (general).')
      )
    );
  }
  await Promise.all(sends);
}

// ---------------------------------------------------------------------------
// Update history (skipped for topic-driven runs, since those aren't part of
// the "avoid repeats" rotation), and clear a used queued topic
// ---------------------------------------------------------------------------
function updateHistory() {
  if (effectiveTopic) return;
  const entry = { date: new Date().toISOString().slice(0, 10), angle, subject: subjectId };
  const updated = [...history, entry].slice(-HISTORY_LIMIT);
  writeFileSync(HISTORY_PATH, JSON.stringify({ recent: updated }, null, 2));
}

function clearQueuedTopicIfUsed() {
  if (usedQueuedTopic) {
    writeFileSync(NEXT_TOPIC_PATH, '');
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
try {
  console.log('Today\'s angle:', angle, subjectId ? `(${subjectId})` : '');
  const report = await generateReport();
  if (!report) {
    throw new Error('generateReport() returned empty content — nothing to post.');
  }
  console.log('Generated report:\n', report);
  await postToDiscord(report);
  updateHistory();
  clearQueuedTopicIfUsed();
  console.log('Posted to Discord successfully.');
} catch (err) {
  console.error('Failed to generate/post report:', err);
  process.exit(1);
}
