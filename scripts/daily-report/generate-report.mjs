// Burger Town Leagues — Daily Report Bot
//
// Run by GitHub Actions once a day. Picks a "today's angle" from the league's
// real stats/history data, asks Claude to write it up in a sports-reporter
// voice, and posts the result to a Discord channel via webhook.
//
// Required environment variables (set as GitHub repo secrets):
//   ANTHROPIC_API_KEY   - from console.anthropic.com
//   DISCORD_WEBHOOK_URL - from Discord channel settings > Integrations > Webhooks

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Check for live current-season data (once BTL Season 1 kicks off, this file
// will start having real standings/matches — swap this block to read from
// wherever that lives once it exists).
// ---------------------------------------------------------------------------
const hasLiveSeason = false; // flip to true once real current-season data exists

// ---------------------------------------------------------------------------
// Pick today's angle
// ---------------------------------------------------------------------------
const angles = hasLiveSeason
  ? ['match_recap', 'upcoming_schedule', 'power_rankings', 'player_spotlight', 'storyline']
  : ['player_spotlight', 'historical_matchup', 'legacy_rankings', 'storyline', 'season_recap'];

const angle = pick(angles);
let context = { angle };

if (angle === 'player_spotlight') {
  const candidates = data.hallOfFame.slice(0, 10);
  const p = pick(candidates);
  const career = data.career.find(c => c.player === p.player);
  const note = playerNotes.find(n => n.player.toLowerCase() === p.player.toLowerCase());
  context.player = p;
  context.career = career;
  if (note) context.playerNote = note;
} else if (angle === 'historical_matchup') {
  context.series = pick(data.series || []);
} else if (angle === 'legacy_rankings') {
  context.top5 = data.hallOfFame.slice(0, 5);
} else if (angle === 'storyline') {
  context.storyline = pick(storylines);
} else if (angle === 'season_recap') {
  const sid = pick(['1', '2', '3', '4', '5']);
  context.season = data.seasonMeta[sid];
  context.champion = data.champions.find(c => c.season === sid);
  context.mvp = data.mvps.find(m => m.season === sid);
  context.standings = data.seasons[sid].standings.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Build the prompt
// ---------------------------------------------------------------------------
const systemPrompt = `You are the official beat reporter for Burger Town Leagues (BTL), a competitive Call of Duty: Black Ops Cold War draft league. Your job is to write a short daily report for the league's Discord channel.

Voice: energetic sports-journalism, like ESPN or a hype esports desk. Confident, a little playful, never corny or over-the-top. Use real names and real numbers from the data given — never invent stats.

Format: a punchy one-line headline, then 2-3 short paragraphs (120-200 words total). No markdown headers, just plain text with the headline as the first line.`;

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
      max_tokens: 600,
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

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'BTL Daily Report',
      embeds: [
        {
          title: headline.slice(0, 256),
          description: body.slice(0, 4000),
          color: 0xe2231a,
          footer: { text: 'Burger Town Leagues' },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
try {
  console.log('Today\'s angle:', angle);
  const report = await generateReport();
  console.log('Generated report:\n', report);
  await postToDiscord(report);
  console.log('Posted to Discord successfully.');
} catch (err) {
  console.error('Failed to generate/post report:', err);
  process.exit(1);
}
