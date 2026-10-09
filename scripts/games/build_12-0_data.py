"""Build the 12-0 game data (src/data/game-12-0.json) from the league workbook.

Usage:  python scripts/games/build_12-0_data.py path/to/CW_Draft_League_History.xlsx
Needs:  pip install openpyxl
Re-run whenever the workbook's Season 1-6 sheets (Season 6 final since Oct 9, 2026), Player Info roles, or All Seasons aliases change.
"""
import openpyxl, re, json, collections
import sys, os
WB = sys.argv[1] if len(sys.argv)>1 else 'CW_Draft_League_History.xlsx'
OUT = sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(__file__),'..','..','src','data','game-12-0.json')
wb=openpyxl.load_workbook(WB,data_only=True)
def num(x):
    return float(x) if isinstance(x,(int,float)) else None
def hdr(rows, i=2):
    # column index by header name, so inserted workbook columns (WAR etc.) don't break this script
    return {str(h).strip(): j for j, h in enumerate(rows[i]) if h is not None}
# alias map from All Seasons
alias={}
canon_list=[]
_as=list(wb['All Seasons'].iter_rows(values_only=True)); _ax=hdr(_as)
_keys=[j for h,j in _ax.items() if h.startswith('Key ')]
for r in _as[3:]:
    if not r[0] or not r[1]: continue
    c=r[0]; canon_list.append(c)
    for k in [r[0]]+[r[j] for j in _keys]:
        if k: alias[str(k).strip().lower()]=c
alias.update({'starry':alias.get('starry','Starry'),'baldie':alias.get('starry','Starry')})
roles={}
for r in wb['Player Info'].iter_rows(min_row=2,values_only=True):
    if r[0]: roles[alias.get(str(r[0]).lower(),r[0])]=r[1]
def canon(n): return alias.get(str(n).strip().lower(), str(n).strip())
seasons={}
for s in range(1,7):
    rows=list(wb['Season %d'%s].iter_rows(values_only=True))
    hx=hdr(rows); iO=hx['Player Overall']; iN=hx['Notes']; iW=hx.get('WAR')
    players={}
    for r in rows[3:]:
        if r[0] and (str(r[0]).startswith('Final') or str(r[0]).startswith('Team Rosters')): break
        if not r[0] or r[0]=='Player' or num(r[iO]) is None: continue
        if s==5 and num(r[4]) is None: continue
        players[str(r[0]).strip().lower()]=dict(name=str(r[0]).strip(),abbr=r[1],k=num(r[2]),d=num(r[3]),ip=num(r[9]),kd=num(r[4]),maps=num(r[5]),hp=num(r[6]),snd=num(r[7]),ctl=num(r[8]),ovr=int(r[iO]),notes=r[iN] or '',war=num(r[iW]) if iW is not None else None)
    # team blocks
    teams=[]; cur=None
    if s==6:
        # Season 6 roster blocks sit side by side (cols A and H) under 'Team Rosters', above 'Team Records by Map'.
        # Standing = regular-season finish; CHAMPION / RUNNER UP markers sit in the header row of the block.
        top=next(i for i,r in enumerate(rows) if r[0] and str(r[0]).startswith('Team Rosters'))
        end=next((i for i,r in enumerate(rows) if r[0] and str(r[0]).startswith('Team Records')), len(rows))
        for i in range(top,end):
            r=rows[i]
            for off in (0,7):
                a=r[off] if len(r)>off else None
                if not (a and ' — Standing:' in str(a)): continue
                name=str(a).split(' — ')[0].strip()
                m=re.search(r'Standing: (\S+)',str(a)); fin=m.group(1) if m else None
                flags=[c for c in r[off+1:off+7] if c in ('CHAMPION','RUNNER UP')]
                t=dict(name=name,finish=fin,champ='CHAMPION' in flags,ru='RUNNER UP' in flags,roster=[])
                for rr in rows[i+2:i+9]:
                    v=rr[off] if len(rr)>off else None
                    if not v or ' — ' in str(v): break
                    if str(v).strip().lower() in players: t['roster'].append(players[str(v).strip().lower()]['name'])
                teams.append(t)
        rows_iter=[]
    else:
        rows_iter=rows
    for i,r in enumerate(rows_iter):
        a=r[0]
        if a and ' — ' in str(a) and ('Finish' in str(a) or 'Standing' in str(a) or 'Blown' in str(a)):
            name=str(a).split(' — ')[0].strip()
            m=re.search(r'(Finish|Standing): (\S+)',str(a))
            fin=m.group(2) if m else None
            flags=[c for c in r[1:8] if c in ('CHAMPION','RUNNER UP')]
            cur=dict(name=name,finish=fin,champ='CHAMPION' in flags,ru='RUNNER UP' in flags,roster=[])
            teams.append(cur); continue
        if a and ('Free Agent' in str(a) or 'Unassigned' in str(a) or str(a).startswith('Note')): cur=None; continue
        if cur and a and a not in ('Player','Overall') and str(a).lower() in players:
            cur['roster'].append(players[str(a).lower()]['name'])
    # S5 team blocks are laid out in side-by-side tables below; second column group at col 7
    if s==5:
        for i,r in enumerate(rows):
            for off in (0,7):
                if len(r)>off+1 and r[off] and r[off+1]=='Overall K/D':
                    t=[x for x in teams if x['name']==r[off]]
                    if not t: continue
                    t=t[0]; t['roster']=[]
                    for rr in rows[i+1:i+9]:
                        v=rr[off]
                        if not v or v=='Overall': break
                        if str(v).lower() in players: t['roster'].append(players[str(v).lower()]['name'])
    seasons[s]=dict(players=players,teams=teams)
    rostered={p for t in teams for p in t['roster']}
    print('S%d: %d players, %d teams, unrostered: %s'%(s,len(players),len(teams),[p['name'] for p in players.values() if p['name'] not in rostered]))
    for t in teams: print('   ',t['name'],t['finish'],'C' if t['champ'] else '','RU' if t['ru'] else '',t['roster'])
raw=json.loads(json.dumps(dict(seasons=seasons,alias=alias,roles=roles),default=str))
missing=set()
for s in seasons.values():
    for p in s['players'].values():
        c=canon(p['name'])
        if c not in roles or not roles[c]: missing.add((p['name'],c))
print('missing roles',sorted(missing))

# ---- build game data ----
import math, itertools, statistics
alias=raw['alias']; roles=raw['roles']
def canon(n): return alias.get(n.strip().lower(), n.strip())
EXCLUDE={'anura'}
MERGE={'i2dreamy':'Dreamy','dreamy':'Dreamy','nickyb':'NickBoston','nickboston':'NickBoston','trapeu':'Trap','trap':'Trap','crazie':'CrazieViews','scary':'Scare','scareacy':'Scare'}
alias.update(MERGE)
roles['Hitta']='SMG'; roles['Scare']='SMG'
for k in ('yankz','marckell','iblades'): roles[{'yankz':'Yankz','marckell':'Marckell','iblades':'iBlades'}[k]]='AR'
extra={'1':{'Vegas Vanity':['Yankz','Marckell','iBlades']},'2':{'Mexico City Warriors':['Karnij','Grihmey']}}
players=[]; teams=[]
unmapped=set()
for s,S in raw['seasons'].items():
    s=int(s)
    byname={p['name']:p for p in S['players'].values()}
    for t in S['teams']:
        ros=list(t['roster'])+extra.get(str(s),{}).get(t['name'],[])
        ids=[]
        for n in ros:
            p=byname[n]; c=canon(n)
            if c.lower() in EXCLUDE: continue
            if c==n.strip() and n.strip().lower() not in alias: unmapped.add(n)
            notes=p['notes']
            acc=[]
            if 'League MVP' in notes: acc.append('MVP')
            if 'All-Star First Team' in notes: acc.append('AS1')
            if 'All-Star Second Team' in notes: acc.append('AS2')
            if t['champ'] or 'Season Champion' in notes: acc.append('CHAMP')
            elif t['ru']: acc.append('RU')
            hp,ctl,snd=p['hp'],p['snd'] and p['ctl'],p['snd']
            hp,ctl=p['hp'],p['ctl']
            if hp is not None and ctl is not None: resp=(2*hp+ctl)/3
            else: resp=hp if hp is not None else ctl
            role=roles.get(c) or 'FLEX'
            pid=len(players)
            players.append(dict(id=pid,n=p['name'],c=c,s=s,t=len(teams),r=role,o=p['ovr'],kd=round(p['kd'],3),w=None if p.get('war') is None else round(p['war'],2),
                ip=None if p['ip'] is None else round(p['ip'],2), k=int(p['k'] or 0), d=int(p['d'] or 0), rk=None if resp is None else round(resp,3), sk=None if snd is None else round(snd,3), m=int(p['maps'] or 0), a=acc))
            ids.append(pid)
        fin=t['finish']
        rank=None
        if fin:
            import re; m=re.match(r'(\d+)',fin); rank=int(m.group(1)) if m else None
        teams.append(dict(id=len(teams),s=s,name=t['name'],fin=fin,rank=rank,champ=t['champ'],ru=t['ru'],p=ids))
# free agents: players with recorded stats who never landed on a roster that season
for s,S in raw['seasons'].items():
    s=int(s)
    rostered=set()
    for t in S['teams']:
        rostered|=set(t['roster'])|set(extra.get(str(s),{}).get(t['name'],[]))
    ids=[]
    for p in S['players'].values():
        n=p['name']; c=canon(n)
        if n in rostered or c.lower() in EXCLUDE or not (p['maps'] or 0): continue
        hp,ctl,snd=p['hp'],p['ctl'],p['snd']
        resp=(2*hp+ctl)/3 if hp is not None and ctl is not None else (hp if hp is not None else ctl)
        pid=len(players)
        players.append(dict(id=pid,n=n,c=c,s=s,t=len(teams),r=roles.get(c) or 'AR',o=p['ovr'],kd=round(p['kd'],3),w=None if p.get('war') is None else round(p['war'],2),
            ip=None if p['ip'] is None else round(p['ip'],2), k=int(p['k'] or 0), d=int(p['d'] or 0), rk=None if resp is None else round(resp,3), sk=None if snd is None else round(snd,3), m=int(p['maps'] or 0), a=[]))
        ids.append(pid)
    if ids: teams.append(dict(id=len(teams),s=s,name='Free Agent',fin=None,rank=None,champ=False,ru=False,p=ids,fa=True))
print('unmapped (no All Seasons alias):',sorted(unmapped))
# opponents: top-4 regular season OR champ/runner-up
for t in teams:
    t['fa']=bool(t.get('fa')); t['elig']= (not t['fa']) and bool(t['p']) and ((t['rank'] is not None and t['rank']<=4) or t['champ'] or t['ru'])
print('eligible opponents:',[(t['s'],t['name']) for t in teams if t['elig']])
# one person, two gamertags in the same season (e.g. Bleepa + Poobs in S4): fold the free-agent line into his rostered line
_fa = {pid for t in teams if t['fa'] for pid in t['p']}
_main = {(q['c'], q['s']): q for q in players if q['id'] not in _fa}
_drop = set()
for q in players:
    if q['id'] in _fa and (q['c'], q['s']) in _main:
        x = _main[(q['c'], q['s'])]; m0, m1 = x['m'], q['m']
        for key in ('rk', 'sk', 'ip'):
            if x[key] is not None and q[key] is not None: x[key] = round((x[key] * m0 + q[key] * m1) / max(1, m0 + m1), 3)
        x['k'] += q['k']; x['d'] += q['d']; x['m'] = m0 + m1; x['kd'] = round(x['k'] / max(1, x['d']), 3); _drop.add(q['id'])
        print('merged', q['n'], 'into', x['n'], 'S%d' % q['s'])
if _drop:
    _new = {}
    players = [q for q in players if q['id'] not in _drop]
    for i, q in enumerate(players): _new[q['id']] = i; q['id'] = i
    for t in teams: t['p'] = [_new[i] for i in t['p'] if i in _new]
    teams = [t for t in teams if t['p'] or not t['fa']]
    _tid = {}
    for i, t in enumerate(teams): _tid[t['id']] = i; t['id'] = i
    for q in players: q['t'] = _tid[q['t']]
json.dump(dict(players=players,teams=teams),open(OUT,'w'),separators=(',',':'))
print(len(players),'player-seasons',len(teams),'teams', len(json.dumps(players))//1024,'KB')
import collections
print(collections.Counter(p['r'] for p in players))
print([ (p['n'],p['s']) for p in players if p['r']=='FLEX'])
