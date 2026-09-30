"""Build the 12-0 game data (src/data/game-12-0.json) from the league workbook.

Usage:  python scripts/games/build_12-0_data.py path/to/CW_Draft_League_History.xlsx
Needs:  pip install openpyxl
Re-run whenever the workbook's Season 1-5 sheets, Player Info roles, or All Seasons aliases change.
"""
import openpyxl, re, json, collections
import sys, os
WB = sys.argv[1] if len(sys.argv)>1 else 'CW_Draft_League_History.xlsx'
OUT = sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(__file__),'..','..','src','data','game-12-0.json')
wb=openpyxl.load_workbook(WB,data_only=True)
def num(x):
    return float(x) if isinstance(x,(int,float)) else None
# alias map from All Seasons
alias={}
canon_list=[]
for r in wb['All Seasons'].iter_rows(min_row=4,values_only=True):
    if not r[0] or not r[1]: continue
    c=r[0]; canon_list.append(c)
    for k in (r[0],r[15],r[16],r[17]):
        if k: alias[str(k).strip().lower()]=c
alias.update({'starry':alias.get('starry','Starry'),'baldie':alias.get('starry','Starry')})
roles={}
for r in wb['Player Info'].iter_rows(min_row=2,values_only=True):
    if r[0]: roles[alias.get(str(r[0]).lower(),r[0])]=r[1]
def canon(n): return alias.get(str(n).strip().lower(), str(n).strip())
seasons={}
for s in range(1,6):
    rows=list(wb['Season %d'%s].iter_rows(values_only=True))
    players={}
    for r in rows[3:]:
        if r[0] and str(r[0]).startswith('Final'): break
        if not r[0] or r[0]=='Player' or num(r[11]) is None: continue
        if s==5 and num(r[4]) is None: continue
        players[str(r[0]).strip().lower()]=dict(name=str(r[0]).strip(),abbr=r[1],k=num(r[2]),d=num(r[3]),ip=num(r[9]),kd=num(r[4]),maps=num(r[5]),hp=num(r[6]),snd=num(r[7]),ctl=num(r[8]),ovr=int(r[11]),notes=r[12] or '')
    # team blocks
    teams=[]; cur=None
    for i,r in enumerate(rows):
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
MERGE={'i2dreamy':'Dreamy','dreamy':'Dreamy','nickyb':'NickBoston','nickboston':'NickBoston','trapeu':'Trap','trap':'Trap'}
alias.update(MERGE)
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
            players.append(dict(id=pid,n=p['name'],c=c,s=s,t=len(teams),r=role,o=p['ovr'],kd=round(p['kd'],3),
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
        players.append(dict(id=pid,n=n,c=c,s=s,t=len(teams),r=roles.get(c) or 'AR',o=p['ovr'],kd=round(p['kd'],3),
            ip=None if p['ip'] is None else round(p['ip'],2), k=int(p['k'] or 0), d=int(p['d'] or 0), rk=None if resp is None else round(resp,3), sk=None if snd is None else round(snd,3), m=int(p['maps'] or 0), a=[]))
        ids.append(pid)
    if ids: teams.append(dict(id=len(teams),s=s,name='Free Agent',fin=None,rank=None,champ=False,ru=False,p=ids,fa=True))
print('unmapped (no All Seasons alias):',sorted(unmapped))
# opponents: top-4 regular season OR champ/runner-up
for t in teams:
    t['fa']=bool(t.get('fa')); t['elig']= (not t['fa']) and bool(t['p']) and ((t['rank'] is not None and t['rank']<=4) or t['champ'] or t['ru'])
print('eligible opponents:',[(t['s'],t['name']) for t in teams if t['elig']])
json.dump(dict(players=players,teams=teams),open(OUT,'w'),separators=(',',':'))
print(len(players),'player-seasons',len(teams),'teams', len(json.dumps(players))//1024,'KB')
import collections
print(collections.Counter(p['r'] for p in players))
print([ (p['n'],p['s']) for p in players if p['r']=='FLEX'])
