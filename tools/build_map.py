import json
d=open('map_small.json').read()
html='''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>REIT SIM 2.0: event map</title>
<style>
:root{--bg:#fbfaf7;--ink:#1d1d1b;--mut:#7a786f;--line:#e3e1d9;--cell:#efede6;--blue:42,120,214;--warn:#eda100;--cri:#e34948;--rec:#1baf7a;--aft:#eb6834}
@media (prefers-color-scheme:dark){:root{--bg:#1a1a19;--ink:#f0efec;--mut:#9a988f;--line:#2f2f2c;--cell:#242422;--blue:57,135,229}}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 24px 40px}
h1{font-size:22px;font-weight:500;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 20px}
.g{display:grid;grid-template-columns:minmax(120px,200px) repeat(60,minmax(0,1fr));column-gap:2px;row-gap:3px;align-items:stretch}
.lab{font-size:13px;padding-right:10px;display:flex;align-items:center;justify-content:flex-end;text-align:right;color:var(--ink)}
.lab.m{color:var(--mut);font-size:12px}
.c{height:24px;border-radius:3px;background:var(--cell);position:relative;cursor:default}
.c.meet::after{content:'';position:absolute;left:-2px;top:-2px;bottom:-2px;border-left:1px solid var(--line)}
.yr{font-size:11px;color:var(--mut);text-align:left;grid-column:span 4;border-left:1px solid var(--line);padding-left:3px}
.ph{height:30px;display:flex;flex-direction:column-reverse;border-radius:3px;overflow:hidden;background:var(--cell)}
.ph i{display:block}
.bar{height:56px;display:flex;align-items:flex-end}.bar i{display:block;width:100%;background:rgba(var(--blue),.75);border-radius:2px 2px 0 0}
.sec{margin:26px 0 8px;font-size:15px;font-weight:500}
.leg{display:flex;flex-wrap:wrap;gap:16px;font-size:12px;color:var(--mut);margin:0 0 12px}
.leg span{display:inline-flex;align-items:center;gap:5px}.leg b{width:11px;height:11px;border-radius:2px;display:inline-block}
#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--bg);font-size:12px;line-height:1.45;padding:8px 10px;border-radius:6px;max-width:320px;display:none;z-index:9}
.mt{display:grid;grid-template-columns:minmax(120px,200px) repeat(15,minmax(0,1fr));gap:6px;align-items:end}
.mt .b{background:rgba(var(--blue),.75);border-radius:3px 3px 0 0;position:relative;flex:1}.mt .b.o{background:var(--mut);opacity:.45}.mt .pair{display:flex;gap:2px;align-items:flex-end;height:74px}.mt .v{font-size:11px;color:var(--mut);text-align:center}
.notes{margin-top:28px;font-size:13px;color:var(--mut);max-width:820px}
</style></head><body><div class="wrap">
<h1>When the scripted events land</h1>
<p class="sub" id="sub"></p>
<div class="leg"><span><b style="background:var(--warn)"></b>warning</span><span><b style="background:var(--cri)"></b>crisis</span><span><b style="background:var(--rec)"></b>recovery</span><span><b style="background:var(--aft)"></b>aftershock</span><span style="margin-left:12px"><b style="background:rgba(var(--blue),.85)"></b>darker = in more games</span><span>board meetings sit in each Q1 (first column of a year)</span></div>
<div class="g" id="grid"></div>
<div class="sec">Story items per board meeting</div><div class="leg" style="margin-bottom:4px"><span><b style="background:var(--mut);opacity:.45"></b>before round 33</span><span><b style="background:rgba(var(--blue),.75)"></b>now</span></div>
<div class="mt" id="mt"></div>
<div class="notes" id="notes">Hover any cell for what happens there. Quarters count from the start of the game: the Year N meeting is the first quarter of Year N+1 (the meeting about Year 3 sits in Y4 Q1). Data from tools/sim_timeline.js: a simple bot plays all 15 years with random choices, so story branches vary; random market events and the random decision deck are not shown.</div>
</div><div id="tip"></div>
<script>
const D=__DATA__;
const g=document.getElementById('grid'),tip=document.getElementById('tip');
document.getElementById('sub').textContent=D.N+' simulated games with the round 33 timings, 60 quarters each. One row per storyline. Shade = how often a beat of that story happens in that quarter.';
const el=(c,h)=>{const e=document.createElement('div');e.className=c;if(h!=null)e.innerHTML=h;return e;};
const yq=q=>'Y'+(Math.floor((q-1)/4)+1)+' Q'+((q-1)%4+1);
const show=(e,html)=>{tip.innerHTML=html;tip.style.display='block';const r=e.getBoundingClientRect();let x=r.left+r.width/2-150;x=Math.max(8,Math.min(innerWidth-330,x));tip.style.left=x+'px';tip.style.top=(r.bottom+8)+'px';};
const hide=()=>{tip.style.display='none';};
g.appendChild(el('lab m','Year'));for(let y=1;y<=15;y++)g.appendChild(el('yr',String(y)));
g.appendChild(el('lab','The economy'));
const cols=['var(--warn)','var(--cri)','var(--rec)','var(--aft)'],nm=['warning','crisis','recovery','aftershock'];
D.P.forEach((p,i)=>{const c=el('ph');p.forEach((v,k)=>{if(v>0){const s=document.createElement('i');s.style.height=(v*100)+'%';s.style.background=cols[k];c.appendChild(s);}});
  c.onmouseenter=()=>show(c,'<b>'+yq(i+1)+'</b><br>'+(p.some(v=>v>0)?p.map((v,k)=>v>0?nm[k]+' in '+Math.round(v*100)+'% of games':'').filter(Boolean).join('<br>'):'calm in every game'));c.onmouseleave=hide;g.appendChild(c);});
D.L.forEach(([name,cells])=>{g.appendChild(el('lab',name));
  for(let q=1;q<=60;q++){const c=el('c'+(q%4===1&&q>1?' meet':''));const x=cells[q];
    if(x){const a=Math.min(1,x[0]/1.2);c.style.background='rgba(var(--blue),'+(0.12+0.83*a).toFixed(2)+')';}
    c.onmouseenter=()=>show(c,'<b>'+yq(q)+' · '+name+'</b><br>'+(x?x[1].split('; ').join('<br>')+'<br><span style="opacity:.7">'+x[0].toFixed(2)+' beats per game</span>':'nothing'));c.onmouseleave=hide;g.appendChild(c);}});
g.appendChild(el('lab','All storylines together'));
const mx=Math.max(...D.T);D.T.forEach((v,i)=>{const c=el('bar'),s=document.createElement('i');s.style.height=(v/mx*100)+'%';c.appendChild(s);c.onmouseenter=()=>show(c,'<b>'+yq(i+1)+'</b><br>'+v.toFixed(1)+' scripted beats per game');c.onmouseleave=hide;g.appendChild(c);});
const mt=document.getElementById('mt');mt.appendChild(el('lab m','average per game'));
const mm=Math.max(...D.M,...(D.MO||[0]));D.M.forEach((v,i)=>{const w=el('');w.appendChild(el('v',v.toFixed(1)));const pr=el('pair');if(D.MO){const o=el('b o');o.style.height=Math.max(2,D.MO[i]/mm*70)+'px';o.title='before: '+D.MO[i].toFixed(1);pr.appendChild(o);}const b=el('b');b.style.height=Math.max(2,v/mm*70)+'px';pr.appendChild(b);w.appendChild(pr);w.appendChild(el('v','Y'+(i+1)));mt.appendChild(w);});
</script></body></html>'''
open('/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/EVENT_MAP.html','w').write(html.replace('__DATA__',d))
print('ok')
