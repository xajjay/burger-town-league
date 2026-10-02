"""BTL Player Overall (season + career), v3 "all-era" model.

Usage:  python scripts/overalls/build_overalls.py path/to/CW_Draft_League_History.xlsx [out_dir]
Needs:  pip install openpyxl pandas numpy

Reads (values only): WAR Log, WAR Config, Season 1-6, All Seasons.
Writes to out_dir (default: scripts/overalls/out):
  overall_model.csv  one row per player-season: components (in OVR points), season-basis OVR,
                     league-strength adjustment and the all-era OVR used as the Player Overall
  career_model.csv   one row per All Seasons player: Talent, Longevity, Hardware, Career OVR
  league_strength.csv

SEASON OVERALL (per map, summed into a season rating in "wins added per map")
  1. Slaying     = wins per net kill for the mode (HP .0186, SnD .0483, CTL .0235; S1 blended .0243)
                   x (net kills - season/mode average)
  2. Schedule    = +0.31 x (strength of the 4 opponents who actually played the map - season average)
  3. Shorthanded = +0.0117 for a team's core players on maps where one of its top-2 players is out
                   and the sub is 10+ OVR worse (never credited to the sub)
  4. Sample size = prior(n) + n/(n+6) x (observed - prior(n)),  prior(n) = -0.233 e^(-n/5)
                   (Season 1 is playoffs only: its prior uses the player's share of his team's maps)
  5. SMG credit  = SMG season K/D mapped to the AR K/D of equal rarity (S2-S6 regulars), converted to
                   net kills at the player's interactions/map, shrunk n/(n+6). Flex: WAR Config F5:G14
  6. Objective   = S5+ only, vs role average, recorded maps only, shrunk k=6 per mode, weighted by mode
                   share: hill time x.00235/sec, plants x.034, defuses x.0685, Control obj kills x.0059
  Season OVR = 78.6 + 129.7 x rating, clamp 50-99.
  ALL-ERA OVR (the Player Overall) = season rating + league strength of that season (S2-S6 fixed-effects
  fit on players who played 2+ of those seasons; Season 1 is kept on its own basis, adjustment 0).

CAREER OVERALL = Talent + Longevity + Hardware, capped at 99 (a perfect 6-season career ~107)
  W (season-equivalents) = sum of min(1, maps/20) per season (S1: maps/16)
  Talent   = prior(W) + W/(W+0.83) x (0.7 x weighted avg season OVR + 0.3 x best-3 avg - prior(W)),
             prior(W) = 78.6 - 23.6 e^(-W/0.39)
  Longevity = 4 x (W/6)^0.75 ;  Hardware = 8 x (1 - e^(-points/8)),
             points: MVP 1.5, All-Star 1st 0.75, 2nd 0.4, Champion 0.5 (All Seasons accolade notes)
"""
import os, re, sys
import numpy as np
import pandas as pd
import openpyxl

WB = sys.argv[1] if len(sys.argv) > 1 else 'CW_Draft_League_History.xlsx'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)

# ---------------- constants (frozen Oct 2026; see docstring) ----------------
B = {'HP': 0.0186, 'SND': 0.0483, 'CTL': 0.0235}
B_MIX = 0.0243207342415147
SHARE = {'HP': 0.39, 'SND': 0.32, 'CTL': 0.29}
OBJW = {'hill': 0.00235, 'plant': 0.034, 'defuse': 0.0685, 'objk': 0.25 * 0.0235}
K = 6.0; PRIOR_A, PRIOR_T = 0.233, 5.0
OPP_COEF, SHORT, SHORT_GAP = 0.31, 0.0117, 0.07
MS, MA, RAT = 0.982, 0.979, 1.348            # SMG K/D rarity mapping
A_OVR, B_OVR = 78.6, 129.7
CAREER = dict(K=0.83, AVG=78.6, PRIOR_B=23.6, PRIOR_T=0.39, L_MAX=4.0, H_MAX=8.0, H_SCALE=8.0, PRIME_W=0.3,
              PTS=dict(mvp=1.5, first=0.75, second=0.4, champ=0.5))

def prior(n):
    return -PRIOR_A * np.exp(-np.asarray(n, float) / PRIOR_T)

norm = lambda s: re.sub(r'[^a-z0-9]', '', str(s).lower())
ovr = lambda x: np.clip(np.floor(A_OVR + B_OVR * np.asarray(x, float) + 0.5), 50, 99).astype(int)

# ---------------- read workbook ----------------
wb = openpyxl.load_workbook(WB, read_only=True, data_only=True)
sheet = lambda n: [list(r) for r in wb[n].iter_rows(values_only=True)]
W_LOG = sheet('WAR Log'); CFG = sheet('WAR Config'); ALLS = sheet('All Seasons')
TABS = {s: sheet('Season %d' % s) for s in range(1, 7)}
alias = {norm(r[0]): r[1] for r in CFG[28:83] if r[0] and r[1]}
flex = {r[5]: float(r[6]) for r in CFG[4:14] if r[5] and isinstance(r[6], (int, float))}
canon_n = lambda s: norm(alias.get(norm(s), s))

hdr = W_LOG[0]
log = pd.DataFrame([r[:len(hdr)] for r in W_LOG[1:] if isinstance(r[0], (int, float))], columns=hdr)
log = log[log.Maps.fillna(0) > 0].copy()

# ================= Seasons 2-6 (per-map data) =================
pm = log[log.Season >= 2].copy()
pm['mode'] = pm.Mode.str.upper().replace({'CONTROL': 'CTL'})
pm['mapno'] = pm.Slot
occ, cnt, prev = [], {}, None
m6 = (pm.Season == 6).values
for s in pm.loc[m6, 'Series']:            # S6 series names repeat (rematches): number consecutive runs
    if s != prev:
        cnt[s] = cnt.get(s, 0) + 1; prev = s
    occ.append(cnt[s])
pm['sid'] = None
pm.loc[m6, 'sid'] = ['6|%s|%d' % (s, o) for s, o in zip(pm.loc[m6, 'Series'], occ)]
pm.loc[~m6, 'sid'] = ['%d|%d' % (s, m) for s, m in zip(pm.loc[~m6, 'Season'], pm.loc[~m6, 'MatchID'])]
pm['mapkey'] = pm.sid + '|' + pm.mapno.astype(int).astype(str)
n_ = pm.Player.str.lower().str.replace(r'[^a-z0-9]', '', regex=True)
pm['Player'] = n_.map(pm.groupby(n_).Player.agg(lambda x: x.value_counts().index[0]))   # merge spellings
pm['smg'] = [flex.get(p, 1.0 if r == 'SMG' else 0.0) for p, r in zip(pm.Player, pm.Role)]
pm['K'] = pm.Kills.astype(float); pm['D'] = pm.Deaths.astype(float); pm['net'] = pm.K - pm.D
pm['hill'] = pm['Hill Time (sec)']; pm['plants'] = pm.Plants; pm['defuses'] = pm.Defuses; pm['objk'] = pm['Obj Kills']
pm = pm.reset_index(drop=True)

def centered(d, ctx, col):
    pure = ctx[(ctx.smg == 0) | (ctx.smg == 1)]
    g = pure.groupby(['Season', 'mode', 'smg'])[col].mean().unstack().reindex(pd.MultiIndex.from_arrays([d.Season, d['mode']]))
    return d[col].values - ((1 - d.smg.values) * g[0.0].values + d.smg.values * g[1.0].values)

def team_season_opp(d):
    c = d.assign(w=d['mode'].map(B) * d.net)
    ts = c.groupby(['Season', 'Team', 'mapkey']).w.sum().reset_index().groupby(['Season', 'Team']).w.agg(['mean', 'size']).reset_index()
    m = dict(zip(zip(ts.Season, ts.Team), ts['mean'] * ts['size'] / (ts['size'] + 10)))
    return np.array([m.get((s, o), 0.0) for s, o in zip(d.Season, d.Opponent)]) / 4

# ---- pass 1: preliminary ratings, used only to measure lineup strength ----
p = pm[(pm.smg == 0) | (pm.smg == 1)].copy()
p['dm'] = p.net - p.groupby(['Season', 'mode']).net.transform('mean')
gg = p.groupby(['mode', 'smg']).dm.mean().unstack(); OFF = (gg[1.0] - gg[0.0]).to_dict()
lm = pm.groupby(['Season', 'mode']).net.mean()
base = lm.reindex(pd.MultiIndex.from_arrays([pm.Season, pm['mode']])).values + pm['mode'].map(OFF).values * (pm.smg.values - 0.5)
d = pm.copy()
d['vs'] = d['mode'].map(B) * (d.net - base) + team_season_opp(d)
g = d.groupby(['Season', 'Player']); n = g.vs.size(); pr = prior(n)
R0 = pr + n / (n + K) * (g.vs.mean() - pr)
d['r'] = [R0[(s, q)] for s, q in zip(d.Season, d.Player)]
tm = d.groupby(['Season', 'Team', 'Player']).size().reset_index(name='n')
core = {(s, t): set(x.sort_values('n', ascending=False).Player.head(4)) for (s, t), x in tm.groupby(['Season', 'Team'])}
d['is_core'] = [q in core[(s, t)] for s, t, q in zip(d.Season, d.Team, d.Player)]
L = d.groupby(['mapkey', 'Team']).agg(lsum=('r', 'sum'), season=('Season', 'first')).reset_index()
d = d.merge(L[['mapkey', 'Team', 'lsum']], on=['mapkey', 'Team'])
d = d.merge(L.rename(columns={'Team': 'Opponent', 'lsum': 'opp_lsum'})[['mapkey', 'Opponent', 'opp_lsum']], on=['mapkey', 'Opponent'])
rows = []
for (mk, t), x in d.groupby(['mapkey', 'Team']):
    s = x.Season.iloc[0]; present = set(x.Player); c = core[(s, t)]
    miss = [R0[(s, q)] for q in c if q not in present]; subs = [R0[(s, q)] for q in present if q not in c]
    second = sorted([R0[(s, q)] for q in c], reverse=True)[1]
    top2 = [q for q in c if R0[(s, q)] >= second]
    rows.append(dict(mapkey=mk, Team=t, gap=(max(miss) - min(subs)) if miss and subs else 0.0,
                     miss_top2=any(q not in present for q in top2)))
d = d.merge(pd.DataFrame(rows), on=['mapkey', 'Team'])

# ---- pass 2: final per-map values ----
lm = pm.groupby(['Season', 'mode']).net.mean()
d['slay'] = d['mode'].map(B) * (d.net - lm.reindex(pd.MultiIndex.from_arrays([d.Season, d['mode']])).values)
d['sos'] = OPP_COEF * (d.opp_lsum - d.groupby('Season').opp_lsum.transform('mean'))
d['short'] = np.where(d.is_core & d.miss_top2 & (d.gap > SHORT_GAP), SHORT, 0.0)
o = np.full(len(d), np.nan)
hp = (d['mode'] == 'HP').values; sn = (d['mode'] == 'SND').values; ct = (d['mode'] == 'CTL').values
o[hp] = OBJW['hill'] * centered(d, pm, 'hill')[hp]
o[sn] = OBJW['plant'] * centered(d, pm, 'plants')[sn] + OBJW['defuse'] * centered(d, pm, 'defuses')[sn]
o[ct] = OBJW['objk'] * centered(d, pm, 'objk')[ct]
d['objv'] = o
d['v'] = d.slay + d.sos + d['short']
g = d.groupby(['Season', 'Player']); n = g.v.size(); pr = prior(n); w = n / (n + K)
slay_tot = pr + w * (g.v.mean() - pr)
Kt, Dt = g.K.sum(), g.D.sum(); kd = Kt / Dt; I = (Kt + Dt) / n; smg = g.smg.mean()
kdE = np.where(kd > MS, MA + (kd - MS) * RAT, kd + (MA - MS)); kdE = kd + smg * (kdE - kd)
smg_credit = w * I * ((kdE - 1) / (kdE + 1) - (kd - 1) / (kd + 1)) * g.apply(lambda x: x['mode'].map(B).mean())
objr = 0
for md, sh in SHARE.items():
    y = d[(d['mode'] == md) & d.objv.notna()].groupby(['Season', 'Player']).objv.agg(['mean', 'size'])
    objr = objr + sh * (y['size'] / (y['size'] + K) * y['mean']).reindex(n.index).fillna(0)
sos = g.sos.mean() * w; sh_ = g['short'].mean() * w
S26 = pd.DataFrame({'maps': n, 'K': Kt, 'D': Dt, 'smg': smg, 'team': g.Team.agg(lambda x: x.mode().iloc[0]),
                    'slaying': slay_tot - sos - sh_, 'smg_credit': smg_credit, 'objective': objr,
                    'schedule': sos, 'shorthanded': sh_})

# ================= Season 1 (playoff series totals) =================
s1 = log[log.Season == 1].copy()
s1['smg'] = [flex.get(q, 1.0 if r == 'SMG' else 0.0) for q, r in zip(s1.Player, s1.Role)]
s1['K'] = s1.Kills.astype(float); s1['D'] = s1.Deaths.astype(float); s1['m'] = s1.Maps.astype(float)
s1['slay'] = B_MIX * ((s1.K - s1.D) / s1.m - (s1.K - s1.D).sum() / s1.m.sum())
gq = s1.assign(v=s1.slay * s1.m).groupby('Player'); n1 = gq.m.sum()
R1 = n1 / (n1 + K) * (gq.v.sum() / n1)
s1['r'] = s1.Player.map(R1); s1['sid'] = s1.MatchID.astype(int)
L1 = s1.groupby(['sid', 'Team']).r.sum().reset_index(name='lsum')
s1 = s1.merge(L1.rename(columns={'Team': 'Opponent', 'lsum': 'opp_lsum'}), on=['sid', 'Opponent'])
s1['sos'] = OPP_COEF * (s1.opp_lsum - np.average(s1.opp_lsum, weights=s1.m))
tm1 = s1.groupby(['Team', 'Player']).m.sum().reset_index()
core1 = {t: set(x.sort_values('m', ascending=False).Player.head(4)) for t, x in tm1.groupby('Team')}
s1['short'] = 0.0
for (sid, t), x in s1.groupby(['sid', 'Team']):
    c = core1[t]; present = set(x.Player); top2 = sorted(c, key=lambda q: -R1[q])[:2]
    miss = [R1[q] for q in c if q not in present]; subs = [R1[q] for q in present if q not in c]
    if any(q not in present for q in top2) and miss and subs and max(miss) - min(subs) > SHORT_GAP:
        s1.loc[x.index[x.Player.isin(c)], 'short'] = SHORT
s1['v'] = s1.slay + s1.sos + s1['short']
gq = s1.groupby('Player'); n1 = gq.m.sum(); w1 = n1 / (n1 + K)
mean1 = (s1.v * s1.m).groupby(s1.Player).sum() / n1
team1 = gq.Team.agg(lambda x: x.mode().iloc[0])
share = (n1 / team1.map(s1.drop_duplicates(['sid', 'Team']).groupby('Team').m.sum())).clip(upper=1)
pr1 = prior(25 * share); slay1 = pr1 + w1 * (mean1 - pr1)
Kt, Dt = gq.K.sum(), gq.D.sum(); kd = Kt / Dt; I = (Kt + Dt) / n1; smg = gq.smg.mean()
kdE = np.where(kd > MS, MA + (kd - MS) * RAT, kd + (MA - MS)); kdE = kd + smg * (kdE - kd)
sos1 = (s1.sos * s1.m).groupby(s1.Player).sum() / n1 * w1; sh1 = (s1['short'] * s1.m).groupby(s1.Player).sum() / n1 * w1
S1 = pd.DataFrame({'maps': n1, 'K': Kt, 'D': Dt, 'smg': smg, 'team': team1,
                   'slaying': slay1 - sos1 - sh1, 'smg_credit': w1 * I * ((kdE - 1) / (kdE + 1) - (kd - 1) / (kd + 1)) * B_MIX,
                   'objective': 0.0, 'schedule': sos1, 'shorthanded': sh1})
S1.index = pd.MultiIndex.from_product([[1], S1.index], names=['Season', 'Player'])

M = pd.concat([S1, S26]).reset_index()
M['rating'] = M[['slaying', 'smg_credit', 'objective', 'schedule', 'shorthanded']].sum(axis=1)

# ================= league strength (S2-S6), Season 1 kept on its own basis =================
ident = {}
for r in ALLS[3:]:
    if r[0]:
        for k in [r[0]] + list(r[22:25]):
            if k: ident[canon_n(k)] = norm(r[0])
M['pid'] = [ident.get(canon_n(q), canon_n(q)) for q in M.Player]
M['w'] = np.minimum(1, M.maps / np.where(M.Season == 1, 16, 20))
f = M[M.Season >= 2]; f = f[f.groupby('pid').Season.transform('nunique') >= 2]
P = sorted(f.pid.unique()); pi = {q: i for i, q in enumerate(P)}
X = np.zeros((len(f), len(P) + 5))
for k, (q, s) in enumerate(zip(f.pid, f.Season)):
    X[k, pi[q]] = 1; X[k, len(P) + s - 2] = -1
sw = np.sqrt(f.w.values)
mw = M[M.Season >= 2].groupby('Season').maps.sum(); cw = np.zeros(len(P) + 5); cw[len(P):] = mw.values / mw.sum()
beta = np.linalg.lstsq(np.vstack([X * sw[:, None], cw * 1e3]), np.concatenate([f.rating.values * sw, [0]]), rcond=None)[0]
LEAGUE = {1: 0.0, **{s: beta[len(P) + s - 2] for s in range(2, 7)}}
M['league_adj'] = M.Season.map(LEAGUE)
M['season_ovr'] = ovr(M.rating)
M['ovr'] = ovr(M.rating + M.league_adj)
M['kd'] = M.K / M.D
M['role'] = np.where(M.smg >= .99, 'SMG', np.where(M.smg <= .01, 'AR', 'Flex'))

# ---- map Season-tab spellings onto model rows ----
tabrows = []
for s, T in TABS.items():
    h = T[2]; im = h.index('Maps Played')
    for row in T[3:]:
        a = row[0]
        if isinstance(a, str) and (a.startswith('Final') or a.startswith('Team Rosters')): break
        if not a or a == 'Player' or not isinstance(row[im], (int, float)): continue
        tabrows.append((s, str(a), canon_n(a), float(row[im])))
key = {(s, canon_n(q)): i for i, (s, q) in enumerate(zip(M.Season, M.Player))}
names = {}                                  # one model row can sit under 2 spellings on a tab (e.g. Bleepa + Poobs)
for s, a, c, maps in tabrows:
    i = key.get((s, c))
    if i is not None and maps > 0:
        names.setdefault(i, []).append(a)
M['tab_name'] = [names.get(i, [None]) for i in range(len(M))]
M = M.explode('tab_name').reset_index(drop=True)
M['key'] = [('%d|%s' % (s, t)) if isinstance(t, str) else '' for s, t in zip(M.Season, M.tab_name)]

# ================= career =================
def acc(t):
    t = str(t or '')
    return (sum(int(x) for x in re.findall(r'(\d+)x MVP', t)), sum(int(x) for x in re.findall(r'(\d+)x Champion', t)),
            len(re.findall(r'First Team', t)), len(re.findall(r'Second Team', t)))
ovr_by = {(s, canon_n(q)): v for s, q, v in zip(M.Season, M.Player, M.ovr)}
crs = []
C = CAREER
for r in ALLS[3:]:
    if not r[0] or not isinstance(r[14], (int, float)): continue
    keys = {norm(k) for k in r[22:25] if k}
    seas = [(s, ovr_by[(s, c)], maps) for s, a, c, maps in tabrows if norm(a) in keys and (s, c) in ovr_by]
    if not seas: continue
    wv = np.array([min(1.0, m / (16 if s == 1 else 20)) for s, v, m in seas]); vv = np.array([v for s, v, m in seas], float)
    Wt = wv.sum(); avg = (wv * vv).sum() / Wt
    idx = np.argsort(-vv)[:3]; prime = (wv[idx] * vv[idx]).sum() / wv[idx].sum()
    blend = (1 - C['PRIME_W']) * avg + C['PRIME_W'] * prime
    prr = C['AVG'] - C['PRIOR_B'] * np.exp(-Wt / C['PRIOR_T'])
    talent = prr + Wt / (Wt + C['K']) * (blend - prr)
    mvp, ch, fi, se = acc(r[21])
    pts = C['PTS']['mvp'] * mvp + C['PTS']['first'] * fi + C['PTS']['second'] * se + C['PTS']['champ'] * ch
    Lg = C['L_MAX'] * min(1, Wt / 6) ** 0.75; Hw = C['H_MAX'] * (1 - np.exp(-pts / C['H_SCALE']))
    crs.append(dict(player=r[0], seasons_eq=round(Wt, 2), avg_season_ovr=round(avg, 1), prime_best3=round(prime, 1),
                    talent=round(talent, 2), longevity=round(Lg, 2), hardware=round(Hw, 2), accolade_points=pts,
                    career_ovr=int(min(99, max(50, np.floor(talent + Lg + Hw + 0.5))))))
CM = pd.DataFrame(crs)

# ================= write =================
pts = lambda c: (M[c] * B_OVR).round(2)
out = pd.DataFrame({'key': M.key, 'season': M.Season, 'player': M.Player, 'tab_name': M.tab_name, 'team': M.team,
                    'role': M.role, 'maps': M.maps, 'kd': M.kd.round(3),
                    'slaying': pts('slaying'), 'smg_credit': pts('smg_credit'), 'objective': pts('objective'),
                    'schedule': pts('schedule'), 'shorthanded': pts('shorthanded'), 'league_adj': pts('league_adj'),
                    'season_ovr': M.season_ovr, 'ovr': M.ovr}).sort_values(['season', 'ovr'], ascending=[True, False])
out.to_csv(os.path.join(OUT, 'overall_model.csv'), index=False)
CM.sort_values('career_ovr', ascending=False).to_csv(os.path.join(OUT, 'career_model.csv'), index=False)
pd.DataFrame({'season': list(LEAGUE), 'wins_per_map': list(LEAGUE.values()),
              'ovr_points': [round(v * B_OVR, 2) for v in LEAGUE.values()]}).to_csv(os.path.join(OUT, 'league_strength.csv'), index=False)
print('league strength (OVR pts):', {s: round(v * B_OVR, 1) for s, v in LEAGUE.items()})
print('model rows: %d (%d keyed to Season tabs); careers: %d' % (len(out), (out.key != '').sum(), len(CM)))
