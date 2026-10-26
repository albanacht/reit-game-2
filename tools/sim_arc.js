const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
const html = fs.readFileSync(P+'/index.html','utf8'); const srcs = order.map(f=>[f,fs.readFileSync(P+'/'+f,'utf8')]);
const errs=[];
function boot(){
  const dom = new JSDOM(html, { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
  const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x')); w.Element.prototype.scrollIntoView=function(){};
  const noop=()=>{}; w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
  w.console.log=()=>{}; w.console.error=m=>errs.push(String(m).slice(0,120));
  srcs.forEach(([f,s])=>{ try{ w.eval(s);}catch(e){ errs.push('LOAD '+f+': '+e.message);} });
  w.UI.newGame(); return w;
}
const N=+(process.env.N||12);
const byPhase={}, byVariant={}; let narrated=false; const totDef=[]; const eqDrop=[];
for (let r=0;r<N;r++){
  const w=boot(), G=w.GameState, A=w.Arc;
  const v=G.arc.variant; byVariant[v]=byVariant[v]||{runs:0,peakRate:0,peakSpread:0,valueDrop:0};
  byVariant[v].runs++;
  const rows=[]; let startRate=G.market.baseInterestRate, peak=0, peakSp=0;
  const val0 = G.cityRivals.concat(G.portfolio,G.propertyMarket).reduce((a,p)=>a+p.currentValue,0); let minVal=val0;
  let defaultsBefore=0;
  for (let q=0;q<60 && !G.meta.gameOver;q++){
    const ph=A.phase(G.totalQuartersElapsed()+1);
    const d0=G._defaults||0;
    let res; try { res=w.Financials.runQuarter(); } catch(e){ errs.push('Q: '+e.message); break; }
    const dd=(G._defaults||0)-d0;
    byPhase[ph]=byPhase[ph]||{q:0,def:0,cov:0}; byPhase[ph].q++; byPhase[ph].def+=dd;
    const covs=Object.values(G.tenants).filter(t=>t.status==='active'&&t.coverage!=null).map(t=>t.coverage);
    byPhase[ph].cov+=covs.reduce((a,b)=>a+b,0)/covs.length;
    peak=Math.max(peak,G.market.baseInterestRate); peakSp=Math.max(peakSp,A.spreadAdd());
    const val = G.cityRivals.concat(G.portfolio,G.propertyMarket).reduce((a,p)=>a+p.currentValue,0); minVal=Math.min(minVal,val);
    rows.push({q:G.totalQuartersElapsed(),ph:A.phase(),cyc:G.market.cycle,rate:G.market.baseInterestRate,sp:A.spreadAdd(),
               borrow:w.Market.getCurrentBorrowingRate(),val:Math.round(val), ev:((res&&res.firedEvents)||[]).filter(e=>e.isArc).map(e=>e.headline)});
  }
  totDef.push(G._defaults||0); byVariant[v].peakRate+=peak-startRate; byVariant[v].peakSpread+=peakSp; byVariant[v].valueDrop+=(1-minVal/val0);
  if (false) {
    narrated=true;
    console.log('ONE RUN: '+A.describe());
    rows.filter((x,i)=>i%2===0).forEach(x=>console.log(
      `  Y${Math.floor((x.q-1)/4)+1}Q${((x.q-1)%4)+1}  ${x.ph.padEnd(10)} ${x.cyc.padEnd(11)} base ${x.rate.toFixed(2)}%  borrow ${x.borrow.toFixed(2)}%  city value $${x.val}M`));
    console.log('  arc headlines this run:'); rows.forEach(x=>x.ev.forEach(h=>console.log('   · '+h.slice(0,110))));
  }
}
console.log(`\n${N} runs — by phase (per quarter):`);
['cheap','warning','crisis','recovery','aftershock','late'].forEach(p=>{const b=byPhase[p]; if(!b)return;
  console.log(`  ${p.padEnd(10)} tenant defaults/qtr ${(b.def/b.q).toFixed(3)}   avg tenant coverage ${(b.cov/b.q).toFixed(2)}x   (${b.q} qtrs)`);});
console.log('\nby variant:');
Object.entries(byVariant).forEach(([v,b])=>console.log(`  ${v.padEnd(16)} runs ${b.runs}  base-rate rise to peak +${(b.peakRate/b.runs).toFixed(2)}pp  peak extra spread +${(b.peakSpread/b.runs).toFixed(2)}pp  worst city-value drop ${(b.valueDrop/b.runs*100).toFixed(0)}%`));
totDef.sort((a,b)=>a-b); console.log(`\ntenant bankruptcies per run (whole city): avg ${(totDef.reduce((a,b)=>a+b,0)/N).toFixed(1)}, median ${totDef[N>>1]}, range ${totDef[0]}-${totDef[N-1]}`);
console.log('\nERRORS: '+(errs.length?[...new Set(errs)].slice(0,8).join(' | '):'none'));
