import json,sys
d=json.load(open('map.json')); old=json.load(open('old/map.json'))
L=[]
for l in d['lanes']:
  c={}
  for i,(v,top) in enumerate(l['row']):
    if v>0: c[i+1]=[v,'; '.join(f"{k} {p}%" for k,p in top[:3])]
  L.append([l['name'],c])
tot=lambda x:[round(sum(l['row'][i][0] for l in x['lanes']),1) for i in range(60)]
o={'L':L,'P':d['phase'],'T':tot(d),'TO':tot(old),'M':d['load'],'MO':old['load'],'N':d['N']}
json.dump(o,open('map_small.json','w'),ensure_ascii=False,separators=(',',':'))
print('ok')
