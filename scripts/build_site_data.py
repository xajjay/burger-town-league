"""Refresh src/data/real_data.json from the league workbook.

Usage:  python scripts/build_site_data.py path/to/CW_Draft_League_History.xlsx
Needs:  pip install openpyxl

What it updates (columns are found by header name, so inserting columns in the
workbook is safe):
  * seasons["1".."6"].players  - kills/deaths/K/D/maps/mode K/Ds/overall plus
                                 WAR, WAR/10, WAR rank, and (S5+) WAR+ and the
                                 objective stats (hill time, plants, defuses,
                                 obj kills, damage/10)
  * seasons["6"].standings     - built from src/data/season6.json
  * career                     - from the All Seasons tab (now S1-S6), incl. career WAR
  * hallOfFame                 - numbers + rank from the Hall of Fame tab, incl. career WAR
  * seasonRecords["6"]         - computed from src/data/season6-matches.json

Honors / accolades / All-Star picks are left as they are in real_data.json
(they get updated by hand when awards are handed out).
"""
import json, os, re, sys
import openpyxl

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WB = sys.argv[1] if len(sys.argv) > 1 else 'CW_Draft_League_History.xlsx'
DATA = os.path.join(ROOT, 'src', 'data')
OUT = os.path.join(DATA, 'real_data.json')

wb = openpyxl.load_workbook(WB, read_only=True, data_only=True)
sheet = lambda n: [list(r) for r in wb[n].iter_rows(values_only=True)]
J = json.load(open(OUT, encoding='utf-8'))
S6 = json.load(open(os.path.join(DATA, 'season6.json'), encoding='utf-8'))
M6 = json.load(open(os.path.join(DATA, 'season6-matches.json'), encoding='utf-8'))


def norm(s):
    return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


def num(x):
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def rnd(x, n=3):
    v = num(x)
    return None if v is None else round(v, n)


# ---- names: workbook spelling -> the canonical name the site uses ----
alias = dict(J['aliasMap'])
alias.update({'crazie': 'CrazieViews', 'scary': 'Scare', 'acroace': 'Acro Ace', 'lewy': 'Lewy',
              'ephrishy': 'Ephrisy'})
for c in J['career']:
    alias.setdefault(norm(c['player']), c['player'])


def canon(n):
    return alias.get(norm(n), str(n).strip())


def cols(header):
    return {str(h).strip(): i for i, h in enumerate(header) if h is not None}


def col(ix, *names):
    for n in names:
        if n in ix:
            return ix[n]
    for n in names:  # prefix match (e.g. 'WAR+ (incl. Objective)')
        for k, i in ix.items():
            if k.startswith(n):
                return i
    return None


SEASON_FIELDS = {
    'kills': ('Kills',), 'deaths': ('Deaths',), 'kd': ('K/D',), 'maps': ('Maps Played',),
    'hpKd': ('HP K/D',), 'sndKd': ('SnD K/D',), 'ctlKd': ('CTL K/D',),
    'interactionsPerMap': ('Interactions / Map',), 'allStarScore': ('All-Star Score',),
    'overall': ('Player Overall',), 'war': ('WAR',), 'war10': ('WAR / 10 Maps',),
    'warRank': ('WAR Rank',), 'warPlus': ('WAR+',), 'hillPerHp': ('Hill Time / HP Map',),
    'plantsPerSnd': ('Plants / SnD Map',), 'defusesPerSnd': ('Defuses / SnD Map',),
    'objKillsPerCtl': ('Obj Kills / CTL Map',), 'dmgPer10': ('Damage / 10 min',),
    'seriesPlayed': ('Series Played',),
}
INT_FIELDS = {'kills', 'deaths', 'maps', 'overall', 'warRank', 'seriesPlayed'}

abbrev_to_team = {t['abbrev']: t['name'] for t in S6['teams']}

for s in range(1, 7):
    rows = sheet('Season %d' % s)
    ix = cols(rows[2])
    ci = {f: col(ix, *names) for f, names in SEASON_FIELDS.items()}
    ci['war'] = ix.get('WAR')
    wbrows = {}
    for r in rows[3:]:
        a = r[0]
        if isinstance(a, str) and (a.startswith('Final') or a.startswith('Team Rosters')):
            break
        if not a or a == 'Player' or num(r[ci['overall']]) is None or not num(r[ci['maps']]):
            continue
        vals = {}
        for f, i in ci.items():
            if i is None:
                continue
            v = r[i]
            if f in INT_FIELDS:
                vals[f] = None if num(v) is None else int(round(num(v)))
            else:
                vals[f] = rnd(v, 4)
        wbrows[canon(a)] = (str(a).strip(), r[ix['Team']], vals)

    sd = J['seasons'].setdefault(str(s), {'players': [], 'standings': []})
    have = {p['player']: p for p in sd['players']}
    if s == 6:
        sd['players'] = []
        for c, (disp, team, vals) in wbrows.items():
            sd['players'].append(dict(player=c, displayName=disp, team=abbrev_to_team.get(team, team),
                                      honors=[], allStar=None, **vals))
    else:
        for c, (disp, team, vals) in wbrows.items():
            if c not in have:
                print('  S%d: workbook player %r (%s) not in real_data.json - skipped' % (s, disp, c))
                continue
            have[c].update(vals)
    print('Season %d: %d players updated' % (s, len(wbrows)))

# ---- keep roster K/D + overall in each season's standings in sync with the new numbers ----
for sid, sd in J['seasons'].items():
    by = {p['player']: p for p in sd['players']}
    for t in sd.get('standings', []):
        for r in t.get('roster', []):
            p = by.get(r['player']) or by.get(canon(r['player']))
            if p:
                r['kd'], r['overall'] = p['kd'], p['overall']

# ---- Season 6 standings (regular season record from season6.json) ----
s6players = {p['player']: p for p in J['seasons']['6']['players']}
def recsort(t):
    w, l = map(int, t['record'].split('-'))
    return w - l
st = []
# playoff seeds (tiebreaks applied); falls back to record order for anything not listed
S6_SEEDS = ['London Royal Ravens', 'Miami Reapers', 'Detroit Dirty Dogs', 'Nashville Mighty Ducks',
            'San Jose Cougars', 'Newark Stars']
order = sorted(S6['teams'], key=lambda t: (S6_SEEDS.index(t['name']) if t['name'] in S6_SEEDS else 99, -recsort(t)))
for rank, t in enumerate(order, 1):
    names = [t['captain']] + t['players']
    roster = []
    for n in names:
        p = s6players.get(canon(n))
        if p:
            roster.append(dict(player=p['player'], kd=p['kd'], overall=p['overall']))
    roster.sort(key=lambda x: -(x['overall'] or 0))
    st.append(dict(team=t['name'], officialFinish='', champion=False, runnerUp=False, record=t['record'],
                   mapRecord=None, winPct=None, manager=t['captain'], rank=rank, roster=roster))
J['seasons']['6']['standings'] = st

# ---- career (All Seasons tab) ----
rows = sheet('All Seasons')
ix = cols(rows[2])
c_season = {str(k): col(ix, 'S%d K/D' % k) for k in range(1, 7)}
career = {c['player']: c for c in J['career']}
seen = set()
for r in rows[3:]:
    a = r[0]
    if not a or not r[1]:
        continue
    name = canon(a)
    seen.add(name)
    entry = career.get(name)
    if entry is None:
        entry = dict(player=name, accolades='')
        career[name] = entry
        J['career'].append(entry)
        print('  career: added new player', name)
    skd = {k: round(num(r[i]), 4) for k, i in c_season.items() if i is not None and num(r[i]) is not None}
    entry.update(
        seasonsLabel=r[ix["Seasons Appeared (* = <2 series, doesn't qualify)"]] if "Seasons Appeared (* = <2 series, doesn't qualify)" in ix else r[1],
        numQualifyingSeasons=int(num(r[ix['# Qualifying Seasons']]) or 0),
        kills=int(num(r[ix['Total Kills']]) or 0),
        deaths=int(num(r[ix['Total Deaths']]) or 0),
        kd=rnd(r[ix['Overall K/D']], 4) or 0,
        seasonKD=skd,
        maps=int(num(r[ix['Total Maps']]) or 0),
        avgSeasonOverall=rnd(r[ix['Avg Season Overall']], 1),
        playerOverall=None if num(r[ix['Player Overall']]) is None else int(round(num(r[ix['Player Overall']]))),
        careerWar=rnd(r[col(ix, 'Career WAR')], 2),
        war10=rnd(r[col(ix, 'WAR / 10 Maps')], 2),
        warRank=None if num(r[col(ix, 'WAR Rank')]) is None else int(num(r[col(ix, 'WAR Rank')])),
        warPlus=rnd(r[col(ix, 'WAR+')], 2),
        bestSeasonWar=rnd(r[col(ix, 'Best Season WAR')], 2),
        seriesW=None if num(r[col(ix, 'Career Series W')]) is None else int(num(r[col(ix, 'Career Series W')])),
        seriesL=None if num(r[col(ix, 'Career Series L')]) is None else int(num(r[col(ix, 'Career Series L')])),
    )
print('career: %d workbook rows, %d total entries' % (len(seen), len(J['career'])))

# ---- Hall of Fame ----
rows = sheet('Hall of Fame')
hi = next(i for i, r in enumerate(rows) if r and r[0] == 'Rank')
ix = cols(rows[hi])
hof = {h['player']: h for h in J['hallOfFame']}
for r in rows[hi + 1:]:
    if num(r[0]) is None:
        break
    name = canon(r[ix['Player']])
    h = hof.get(name)
    if h is None:
        h = dict(player=name)
        hof[name] = h
        J['hallOfFame'].append(h)
        print('  HOF: added', name)
    h.update(rank=int(r[0]), seasonsPlayedLabel=r[ix['Seasons Played']], numSeasons=int(r[ix['# Seasons']]),
             kills=int(r[ix['Total Kills']]), deaths=int(r[ix['Total Deaths']]), kd=rnd(r[ix['Overall K/D']], 4),
             maps=int(r[ix['Total Maps']]), mvps=int(r[ix['MVP']] or 0), championships=int(r[ix['Championships']] or 0),
             allStar1=int(r[ix['All-Star 1st Team']] or 0), allStar2=int(r[ix['All-Star 2nd Team']] or 0),
             legacyScore=round(num(r[ix['Legacy Score']]), 2),
             careerWar=rnd(r[col(ix, 'Career WAR')], 2), war10=rnd(r[col(ix, 'WAR / 10 Maps')], 2))
J['hallOfFame'].sort(key=lambda h: h['rank'])

# ---- Season 6 records from recorded series ----
MODE = {'Hardpoint': 'HP', 'Search & Destroy': 'SnD', 'Control': 'Control'}
maps_by_mode = {m: [] for m in MODE.values()}
series_tot = []
for se in M6['series']:
    for p in se['players']:
        if p['player'] == 'Aldo':
            continue
        n = canon(p['player'])
        for i, k in enumerate(p['perMap']):
            if k is None:
                continue
            d = p['perMapDeaths'][i]
            maps_by_mode[MODE[se['maps'][i]['mode']]].append((n, k, d, k / d if d else k))
        series_tot.append((n, p['kills'], p['deaths'], p['kills'] / p['deaths'] if p['deaths'] else p['kills']))
pools = dict(maps_by_mode, Series=series_tot)
recs = []
for cat, idx, hi_ in [('Kill Record', 1, True), ('Death Low', 2, False), ('KD Record', 3, True),
                      ('Death Record', 2, True), ('Kill Low', 1, False), ('KD Low', 3, False)]:
    modes = {}
    for m, pool in pools.items():
        if not pool:
            continue
        best = (max if hi_ else min)(pool, key=lambda t: t[idx])
        modes[m] = dict(holder=best[0], value=best[idx])
    recs.append(dict(category=cat, modes=modes))
J['seasonRecords']['6'] = recs

json.dump(J, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('wrote', OUT)
