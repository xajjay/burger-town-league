"""Build the Dynasty game's starting player pool (src/data/game-dynasty.json) from the league workbook.

Usage:  python scripts/games/build_dynasty_data.py path/to/CW_Draft_League_History.xlsx
Needs:  pip install openpyxl. Run scripts/games/build_12-0_data.py first (this reads src/data/game-12-0.json
        for the cleaned player-season list, identity merges and roles).

Every real player gets ONE career profile (Dynasty starts at "Season 1" with no history):
  ovr        career Player Overall (Career Model / All Seasons)  -> Dynasty starting overall
  hp/snd/ctl maps-weighted career K/D by mode (S2-S6; S1 has no mode split)
  ip         interactions per map, war10 = career WAR per 10 maps
  obj        Seasons 5-6 scoreboard data: hill time, plants, defuses, CTL obj kills, first bloods/deaths
  acc        real accolades (only used to seed reputation / personality, never shown as Dynasty history)
  note       Player Info scouting note (used to hand-tune personality)
"""
import openpyxl, json, sys, os, collections
WB = sys.argv[1] if len(sys.argv) > 1 else 'CW_Draft_League_History.xlsx'
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'src', 'data', 'game-dynasty.json')
G120 = json.load(open(os.path.join(ROOT, 'src', 'data', 'game-12-0.json')))
wb = openpyxl.load_workbook(WB, data_only=True)

def num(x):
    return float(x) if isinstance(x, (int, float)) else None
def hdr(rows, i):
    return {str(h).strip(): j for j, h in enumerate(rows[i]) if h is not None}

# ---- identity: name variant -> canonical name, from the 12-0 data (already merged) + All Seasons keys ----
alias = {}
for p in G120['players']:
    alias[p['n'].strip().lower()] = p['c']; alias[p['c'].strip().lower()] = p['c']
AS = list(wb['All Seasons'].iter_rows(values_only=True)); ax = hdr(AS, 2)
keys = [j for h, j in ax.items() if h.startswith('Key ')]
career = {}
for r in AS[3:]:
    if not r[0] or not isinstance(r[3], (int, float)): continue
    c = alias.get(str(r[0]).strip().lower(), str(r[0]).strip())
    for j in keys:
        if r[j]: alias.setdefault(str(r[j]).strip().lower(), c)
    career[c] = dict(ovr=num(r[ax['Player Overall']]), war10=num(r[ax['WAR / 10 Maps']]), notes=r[ax['Notes (Career Accolades)']] or '')
canon = lambda n: alias.get(str(n).strip().lower(), str(n).strip())

# ---- per player-season mode K/Ds from the season tabs ----
modes = collections.defaultdict(lambda: dict(hp=[0, 0], snd=[0, 0], ctl=[0, 0]))
for s in range(2, 7):
    rows = list(wb['Season %d' % s].iter_rows(values_only=True)); hx = hdr(rows, 2)
    for r in rows[3:]:
        if not r[0] or r[0] == 'Player': continue
        if str(r[0]).startswith(('Final', 'Team Rosters')): break
        m = num(r[hx['Maps Played']]) or 0
        if m <= 0: continue
        c = canon(r[0])
        for key, col in (('hp', 'HP K/D'), ('snd', 'SnD K/D'), ('ctl', 'CTL K/D')):
            v = num(r[hx[col]])
            if v is not None:
                w = m * (0.4 if key == 'hp' else 0.33 if key == 'snd' else 0.27)
                modes[c][key][0] += v * w; modes[c][key][1] += w

# ---- Seasons 5-6 scoreboard objective data ----
SL = list(wb['Scoreboard Leaders'].iter_rows(values_only=True)); sx = hdr(SL, 3)
obj = collections.defaultdict(lambda: collections.defaultdict(float))
for r in SL[4:]:
    if not r[1] or not isinstance(r[0], (int, float)): continue
    c = canon(r[1]); o = obj[c]
    def add(rate, maps, key):
        rv, mv = num(r[sx[rate]]), num(r[sx[maps]]) or 0
        if rv is not None and mv > 0: o[key] += rv * mv; o[key + 'N'] += mv
    add('Hill Time / HP map (sec)', 'HP maps', 'hill')
    add('Plants / SnD map', 'SnD maps', 'pl')
    add('Defuses / SnD map', 'SnD maps', 'df')
    add('Obj Kills / CTL map', 'CTL maps', 'ok')
    add('First Bloods / SnD map', 'SnD boards', 'fb')
    add('First Deaths / SnD map', 'SnD boards', 'fd')

# ---- Seasons 5-6 per map: player K/D and W/L by mode+map (map preferences) ----
mapstat = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0, 0]))  # k, d, w, l
for mtab, rtab in (('Matches', 'Map Results'), ('Season 6 Matches', 'Season 6 Map Results')):
    res = {}
    for r in wb[rtab].iter_rows(min_row=2, values_only=True):
        if not r[0] or r[5] in (None, 'FF'): continue
        md = {'HP': 'HP', 'SND': 'SND', 'Control': 'CTL'}.get(r[5])
        if md: res[(str(r[1]).strip(), int(r[3]), str(r[6]).strip())] = (md, str(r[4]).strip(), r[10] == 'Win')
    rows = list(wb[mtab].iter_rows(values_only=True)); hx = {str(h).strip(): j for j, h in enumerate(rows[0]) if h}
    for r in rows[1:]:
        if not r[0] or not r[2]: continue
        c = canon(r[2]); ser = str(r[0]).strip(); tm = str(r[1]).strip()
        for i in range(1, 7):
            k, d = r[hx.get('M%d Kills' % i, 0)], r[hx.get('M%d Deaths' % i, 0)]
            if not isinstance(k, (int, float)) or not isinstance(d, (int, float)): continue
            x = res.get((ser, i, tm))
            if not x: continue
            st = mapstat[c][x[0] + '|' + x[1]]; st[0] += k; st[1] += d; st[2 if x[2] else 3] += 1

notes = {}
for r in wb['Player Info'].iter_rows(min_row=2, values_only=True):
    if r[0] and r[2]: notes[canon(r[0])] = str(r[2]).strip()

# ---- assemble one profile per canonical player ----
by = collections.defaultdict(list)
for p in G120['players']: by[p['c']].append(p)
ROLE_FIX = {'Utopian': 'SMG', 'Hype': 'AR', 'Inkster': 'AR'}
TAGS = json.load(open(os.path.join(os.path.dirname(__file__), 'dynasty_tags.json'))) if os.path.exists(os.path.join(os.path.dirname(__file__), 'dynasty_tags.json')) else {}
out = []
for c, rows in by.items():
    if c.lower() == 'anura': continue
    rows.sort(key=lambda p: p['s'])
    k = sum(p['k'] for p in rows); d = sum(p['d'] for p in rows); m = sum(p['m'] for p in rows)
    if m <= 0: continue
    ipw = [(p['ip'], p['m']) for p in rows if p['ip'] is not None and p['m']]
    ip = sum(a * b for a, b in ipw) / sum(b for _, b in ipw) if ipw else 35.0
    md = modes.get(c)
    mk = lambda key: round(md[key][0] / md[key][1], 3) if md and md[key][1] else None
    acc = collections.Counter(a for p in rows for a in p['a'])
    cv = career.get(c, {})
    ovr = cv.get('ovr')
    if ovr is None:  # Season-1-only aliases etc: maps-weighted season overall, lightly shrunk
        ovr = sum(p['o'] * max(1, p['m']) for p in rows) / sum(max(1, p['m']) for p in rows)
        ovr = 74 + (ovr - 74) * 0.85
    o = obj.get(c)
    ob = None
    if o:
        ob = {}
        for key in ('hill', 'pl', 'df', 'ok', 'fb', 'fd'):
            n = o[key + 'N']
            if n: ob[key] = round(o[key] / n, 3); ob[key + 'N'] = int(n)
    mp = {k: v for k, v in mapstat.get(c, {}).items() if v[2] + v[3] >= 2}
    out.append(dict(n=c, r=ROLE_FIX.get(c, rows[-1]['r']), maps=mp or None, tags=TAGS.get(c), ovr=round(ovr, 1), seasons=len({p['s'] for p in rows}),
                    first=rows[0]['s'], last=rows[-1]['s'], m=m, k=k, d=d, kd=round(k / max(1, d), 3), ip=round(ip, 2),
                    hp=mk('hp'), snd=mk('snd'), ctl=mk('ctl'), war10=None if cv.get('war10') is None else round(cv['war10'], 3),
                    best=max(p['o'] for p in rows), lastO=rows[-1]['o'],
                    acc=dict(mvp=acc['MVP'], as1=acc['AS1'], as2=acc['AS2'], champ=acc['CHAMP'], ru=acc['RU']),
                    obj=ob))
out.sort(key=lambda p: -p['ovr'])
json.dump(dict(players=out), open(OUT, 'w'), separators=(',', ':'))
print(len(out), 'players ->', OUT, '%d KB' % (os.path.getsize(OUT) // 1024))
print('with mode splits:', sum(1 for p in out if p['hp'] is not None), ' with S5-S6 objective data:', sum(1 for p in out if p['obj']), ' with tags:', sum(1 for p in out if p['tags']), ' with map data:', sum(1 for p in out if p['maps']))
print(collections.Counter(p['r'] for p in out))
for p in out[:12]: print(p['n'], p['r'], p['ovr'], p['kd'], p['hp'], p['snd'], p['ctl'], p['obj'] and p['obj'].get('fb'))
print('lowest:', [(p['n'], p['ovr'], p['m']) for p in out[-8:]])
