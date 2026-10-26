import json,collections,re
import sys
src=sys.argv[1] if len(sys.argv)>1 else '.'
runs=json.load(open(src+'/tl_1.json'))+json.load(open(src+'/tl_2.json'))
N=len(runs)
def cls(e):
  k,s,w=e['kind'],e['sys'],e['what']
  if k=='agenda':
    if s=='guest':
      return {'Bob Harlow':('harlow','Bob at the meeting'),'Dr. Levi Cohen':('levi','Levi at the meeting'),'Jack Morrow':('war','Morrow Plaza auction'),
              'Sebastian Hale':('tower','Sebastian at the meeting'),'Henrik Dahl':('index','Granite (Dahl) at the meeting'),'Brett Kessler':('war','Kessler at the meeting'),
              'Dale Voss':('war','Voss, Rennick nominee'),'Eleanor Whitcombe':('port','Eleanor at the meeting')}.get(w)
    if 'Kessler bids' in w: return ('war','Kessler bids')
    if 'seventh seat' in w or 'Kessler' in w: return ('war','Kessler on the agenda')
    if 'Port Logistics' in w: return ('port','Chen proposes the Port scheme')
    if 'Bob Harl' in w or w.startswith('okafor: Harlow'): return ('harlow','Harlow on the agenda')
    if 'Seventy percent let' in w or 'in Year 9' in w: return ('tower','tower debate')
    if 'Thirty years' in w or 'elect a chair' in w or 'I am sorry to do this' in w: return ('chair','Williams steps down / chair vote')
    if 'related-party' in w: return ('gary','Gary vote (related party)')
    if 'page 212' in w: return ('gary','Ledger finds Gary in the proxy')
    if 'Granite voted' in w: return ('tex','Granite votes against Tex')
    if 'Calder' in w: return ('index','Calder & Rowe (bank) item')
    return None
  if k=='card':
    if s=='pr_offer': return ('pr','PR offer: '+w[:30])
    if s.startswith('story_harlow'): return ('harlow',w[:40])
    if s.startswith('gary'): return ('gary',w[:40])
    if s.startswith('port'): return ('port',w[:40])
    if s.startswith('tower'): return ('tower',re.sub(r': \d+% let','',w)[:40])
    if s.startswith('war'): return ('war','press attack' if s in('war_jab','war_leak','war_audit') else w[:40])
    if s=='levi_offer': return ('levi','Petrova\'s letter: hire Levi?')
    if s=='mayor_offer': return ('mayor','Frank asks for four floors')
    return None
  if k=='letter':
    if s=='Jenkins':
      if w in('Storm clouds','Things are going dim','The worst is over','Not again'): return ('econ','Jenkins: '+w)
      if 'press war' in w: return ('war','Jenkins: press war')
      if 'Harlow' in w: return ('harlow','Jenkins: '+w[:30])
      return None
    if s=='Dr. Levi Cohen': return ('levi','Levi forecast: '+w[:28])
    if s=='Bob Harlow': return ('harlow','Bob: '+w)
    if s=='Brett Kessler': return ('war','Kessler: '+w)
    if s=='Eleanor Whitcombe': return ('port','Eleanor: '+w)
    if s=='Gary': return ('gary','Gary: '+w)
    if s=='Marcus Oyelaran': return ('index',w)
    if 'We could join' in w: return ('index','letter: join the index?')
    if s=='Sebastian Hale': return ('tower','Sebastian: '+w)
    if s=='Nora Whitlock':
      return {'Celestial Heights is full':('tower','Ledger: tower is full'),'CEO’s friend joins the board':('tex','Ledger: Tex joins'),
              'The CEO’s scrap yard':('gary','Ledger: the scrap yard'),'REIT and mayor targeted rival’s building':('port','Ledger: Port scheme'),
              'City Hall leases under investigation':('mayor','the City Hall inquiry'),'The only landlord who said no':('mayor','inquiry: the only landlord who said no'),
              'Above market, on the taxpayer':('mayor','inquiry: sweetheart lease exposed'),'The CEO’s speaking fees':('mayor','inquiry: the skim exposed')}.get(w)
    if s.startswith(('Director','Chairman','Chair')):
      if 'Nationa' in w: return ('index','letter: join the index?')
      if 'Harlow' in w or 'About Bob' in w: return ('harlow','director on Harlow')
      if 'Rennick is cracking' in w: return ('war','Rennick is cracking')
    return None
  if k=='stage':
    if s=='chair': return ('chair','new chair')
    if s=='board': return None
    nm={'levi':{'wait → hired':'Levi hired','wait → passed':'Levi passed on','hired → quit':'Levi quits'},
        'tower':{'wait → nephew':'Sebastian arrives','nephew → refused':'tower refused','build → open':'tower opens','held → trophy':'tower becomes trophy','open → sold':'tower sold'},
        'war':{'wait → war':'war starts','war → crisis':'war: takeover crisis','war → done':'war ends'},
        'index':{'out → candidate':'index candidate','candidate → in':'joins the index','in → out':'dropped from index'},
        'port':{'scheme → suit':'Eleanor sues','offer → owned':'Port bought'},
        'harlow':{'loan → decide':'Harlow loan due','loan → aftermath':'Harlow bust'},
        'gary':{'vote → run':'Gary manages buildings','run → ended':'Gary contract ended'}}
    lab=nm.get(s,{}).get(w)
    return (s if s!='yard' else 'gary', lab) if lab else None
  return None
LANES=[('econ','Economy (Jenkins notes)'),('harlow','Bob Harlow'),('war','Kessler / Rennick war'),('levi','Dr. Levi Cohen'),('gary','Gary (Lakeside, scrap yard)'),
       ('port','Eleanor / Port Logistics'),('index','The index (REIT 100)'),('tex','Tex Brennan'),('tower','Sebastian / Celestial Heights'),('mayor','Mayor Frank (City Hall floors)'),('chair','Williams retires, new chair'),('pr','PR offers')]
cells={l:[collections.Counter() for _ in range(61)] for l,_ in LANES}
alive=[0]*61
for r in runs:
  last=max([e['q'] for e in r['ev']]+[r['q']])
  for q in range(1,61):
    if q<=r['q']+1: alive[q]+=1
  for e in r['ev']:
    c=cls(e)
    if not c: continue
    q=min(60,max(1,e['q']))
    cells[c[0]][q][c[1]]+=1
# phases
def phase(a,q):
  if q<a['warnStart']: return 'cheap'
  if q<a['crisisStart']: return 'warning'
  if q<a['crisisEnd']: return 'crisis'
  if q<a['crisisEnd']+8: return 'recovery'
  if a.get('afterStart') and a['afterStart']<=q<a['afterEnd']: return 'aftershock'
  return 'calm'
ph=[{p:0 for p in('warning','crisis','recovery','aftershock')} for _ in range(61)]
for r in runs:
  for q in range(1,61):
    p=phase(r['arc'],q)
    if p in ph[q]: ph[q][p]+=1
out={'N':N,'lanes':[],'phase':[[round(ph[q][p]/N,2) for p in('warning','crisis','recovery','aftershock')] for q in range(1,61)],'alive':alive[1:]}
for l,name in LANES:
  row=[]
  for q in range(1,61):
    c=cells[l][q]; a=max(1,alive[q]); tot=sum(c.values())
    row.append([round(tot/a,2),[[k,round(v/a*100)] for k,v in c.most_common(3)]])
  out['lanes'].append({'id':l,'name':name,'row':row})
# meeting load: story items per meeting by year
load=[]
for y in range(1,16):
  qs=y*4+1; vals=[]
  for r in runs:
    n=sum(1 for e in r['ev'] if e['q']==qs and e['kind']=='agenda' and cls(e))
    if r['q']>=qs-1: vals.append(n)
  load.append(round(sum(vals)/max(1,len(vals)),1))
out['load']=load
json.dump(out,open(sys.argv[2] if len(sys.argv)>2 else 'map.json','w'),separators=(',',':'))
print(len(json.dumps(out)), load)
for L in out['lanes']: print(L['id'], [x[0] for x in L['row']])
