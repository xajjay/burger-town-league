// ============================================================================
// PLACEHOLDER DATA — shaped exactly like the real BTL workbook so the site
// structure won't need to change once we wire in the real published Excel
// data. Replace the arrays below with real values pulled from your
// "Publish to web" CSV links.
// ============================================================================

export const seasons = [
  { id: 1, name: "Season 1", champion: "Renegades", mvp: "Aj", status: "Complete" },
  { id: 2, name: "Season 2", champion: "Havoc", mvp: "CrazieViews", status: "Complete" },
  { id: 3, name: "Season 3", champion: "Syndicate", mvp: "Jmetree", status: "Complete" },
  { id: 4, name: "Season 4", champion: "Nova", mvp: "Hype", status: "Complete" },
  { id: 5, name: "Season 5", champion: "Houston Havoc", mvp: "TBD", status: "Complete" },
];

// One row per player per season — mirrors your "Season N" tabs
export const seasonStats = {
  1: [
    { player: "Aj", team: "Renegades", kills: 812, deaths: 601, kd: 1.35, maps: 34, allStar: "1st Team" },
    { player: "Crooked", team: "Renegades", kills: 790, deaths: 610, kd: 1.30, maps: 34, allStar: "1st Team" },
    { player: "Hype", team: "Wraith", kills: 770, deaths: 615, kd: 1.25, maps: 33, allStar: "1st Team" },
    { player: "Jmetree", team: "Wraith", kills: 700, deaths: 640, kd: 1.09, maps: 32, allStar: "2nd Team" },
    { player: "Renicide", team: "Syndicate", kills: 690, deaths: 650, kd: 1.06, maps: 31, allStar: "" },
  ],
  2: [
    { player: "CrazieViews", team: "Havoc", kills: 840, deaths: 590, kd: 1.42, maps: 35, allStar: "1st Team" },
    { player: "Waly", team: "Havoc", kills: 800, deaths: 610, kd: 1.31, maps: 34, allStar: "1st Team" },
    { player: "Aj", team: "Renegades", kills: 760, deaths: 630, kd: 1.21, maps: 33, allStar: "2nd Team" },
    { player: "Hype", team: "Wraith", kills: 750, deaths: 620, kd: 1.21, maps: 33, allStar: "1st Team" },
  ],
  3: [
    { player: "Jmetree", team: "Syndicate", kills: 820, deaths: 580, kd: 1.41, maps: 34, allStar: "1st Team" },
    { player: "Hype", team: "Wraith", kills: 780, deaths: 600, kd: 1.30, maps: 33, allStar: "1st Team" },
    { player: "Aurora", team: "Atlanta Reign", kills: 740, deaths: 610, kd: 1.21, maps: 32, allStar: "1st Team" },
  ],
  4: [
    { player: "Hype", team: "Nova", kills: 860, deaths: 570, kd: 1.51, maps: 36, allStar: "1st Team" },
    { player: "Aj", team: "Nova", kills: 800, deaths: 600, kd: 1.33, maps: 35, allStar: "1st Team" },
    { player: "Purp", team: "Nova", kills: 770, deaths: 610, kd: 1.26, maps: 34, allStar: "1st Team" },
  ],
  5: [
    { player: "Renicide", team: "NOLA Knights", kills: 300, deaths: 240, kd: 1.25, maps: 10, allStar: "" },
    { player: "Acro_Ace", team: "Oklahoma City Spartans", kills: 280, deaths: 245, kd: 1.14, maps: 9, allStar: "" },
  ],
};

// Career totals across seasons — mirrors "All Seasons"
export const careerStats = [
  { player: "Hype", seasons: [1, 2, 3, 4, 5], kills: 3200, deaths: 2450, kd: 1.31, accolades: "S1 1st Team; S2 1st Team; S3 1st Team; S4 1st Team, MVP" },
  { player: "Aj", seasons: [1, 2, 4], kills: 2400, deaths: 1900, kd: 1.26, accolades: "S1 1st Team, MVP; S2 2nd Team; S4 1st Team" },
  { player: "Jmetree", seasons: [1, 3], kills: 1520, deaths: 1220, kd: 1.25, accolades: "S1 2nd Team; S3 1st Team, MVP" },
  { player: "Renicide", seasons: [1, 3, 4, 5], kills: 2100, deaths: 1850, kd: 1.14, accolades: "S3 2nd Team; S4 2nd Team" },
];

// One row per team per season, for standings pages
export const standings = {
  5: [
    { rank: 1, team: "Houston Havoc", record: "4-0" },
    { rank: 2, team: "NOLA Knights", record: "4-1" },
    { rank: 3, team: "Chicago Syndicate", record: "3-1" },
    { rank: 4, team: "Nashville Mighty Ducks", record: "3-1" },
    { rank: 5, team: "Detroit Dirty Dogs", record: "3-2" },
  ],
};

export const matches = [
  { id: 1, season: 5, week: "Week 1", teamA: "Houston Havoc", teamB: "Illinois Kings", score: "4-0", date: "2026-06-14" },
  { id: 2, season: 5, week: "Week 1", teamA: "NOLA Knights", teamB: "LA Nova", score: "4-1", date: "2026-06-14" },
  { id: 3, season: 5, week: "Week 2", teamA: "Chicago Syndicate", teamB: "Brooklyn Empire", score: "4-2", date: "2026-06-21" },
];

export const social = {
  youtube: "https://www.youtube.com/@BurgerTownLeagues",
  discord: "https://discord.gg/G2kdxeGkZ",
};
