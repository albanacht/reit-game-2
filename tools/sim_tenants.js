// Fast tuning: engine only (no UI), N runs, tenant outcomes.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
const src = order.map(f=>fs.readFileSync(P+'/'+f,'utf8'));
const N=+(process.env.N||30);
const failCount={}, perRun=[], cycles={};
for (let r=0;r<N;r++){
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'}); const w=dom.window;
  w.console.log=()=>{}; w.console.error=()=>{};
  src.forEach(s=>{ try{ w.eval(s);}catch(e){} });
  try{ w.Board.init(); }catch(e){}
  try{ w.Properties.init(); }catch(e){}
  try{ w.Market && w.Market.init && w.Market.init(); }catch(e){}
  try{ w.Financials.init && w.Financials.init(); }catch(e){}
  const G=w.GameState;
  for(let q=0;q<60;q++){ try{ w.Tenants.processQuarter(); w.Market && w.Market.tick && w.Market.tick(); }catch(e){}
    // drive the cycle through a plausible sequence so recessions happen
    const phase=Math.floor(q/10)%4; G.market.cycle=['expanding','stable','contracting','recession'][ (r+phase)%4 ];
    cycles[G.market.cycle]=(cycles[G.market.cycle]||0)+1;
    G.meta.quarter = (q%4)+1;
  }
  const failed=Object.values(G.tenants).filter(t=>t.status==='failed' && !t.id.startsWith('new_'));
  failed.forEach(t=>failCount[t.name]=(failCount[t.name]||0)+1);
  perRun.push(failed.length);
}
perRun.sort((a,b)=>a-b);
console.log(`${N} runs. original-roster defaults per run: avg ${(perRun.reduce((a,b)=>a+b,0)/N).toFixed(1)}  median ${perRun[N>>1]}  range ${perRun[0]}-${perRun[N-1]}`);
console.log('most likely to fail (% of runs):');
Object.entries(failCount).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log('  '+String(Math.round(v/N*100)).padStart(3)+'%  '+k));
