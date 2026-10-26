const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
function boot(){
  const dom = new JSDOM(fs.readFileSync(P+'/index.html','utf8'), { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
  const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x'));
  w.Element.prototype.scrollIntoView=function(){};
  const noop=()=>{}; const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;
  for (const f of order) { try { w.eval(fs.readFileSync(P+'/'+f,'utf8')); } catch(e){} }
  try { w.UI.newGame(); } catch(e){}
  return w;
}
function play(w){
  const G=w.GameState, R=G.ratios;
  if ((R.debtToAssets||0) < 0.45 && G.balance.cash < 50) { try { w.Financials.issueDebt(30,5,false); } catch(e){} }
  const aff=(G.propertyMarket||[]).filter(p=>p.askingPrice*1.02 < G.balance.cash)
      .sort((a,b)=>(b.annualNOI/b.askingPrice)-(a.annualNOI/a.askingPrice));
  if (aff.length && G.balance.cash>20) { try{ w.Properties.buyProperty(aff[0].id);}catch(e){} }
}
const sig={}, endReason={}; let complete=0, fired=0, N=+(process.env.RUNS||15);
let firstCrisisQ=[];
for (let r=0;r<N;r++){
  const w=boot(); let fc=null;
  for (let q=0;q<60;q++){
    play(w);
    try { w.Financials.runQuarter(); } catch(e){ break; }
    const s=w.Situation.get();
    if (s.state==='crisis' && fc===null) fc=q+1;
    s.signals.forEach(x=>{ if(x.severity===3) sig[x.key]=(sig[x.key]||0)+1; });
    if (w.GameState.meta.gameOver) break;
  }
  firstCrisisQ.push(fc===null?99:fc);
  if (w.GameState.meta.runComplete) complete++; else { fired++;
    const why=(w.GameState.meta.gameOverReason||'?').slice(0,45); endReason[why]=(endReason[why]||0)+1; }
}
console.log(`${N} runs, active bot`);
console.log(`reached Y15 : ${complete}/${N}`);
console.log(`ended early : ${fired}/${N}`);
Object.entries(endReason).forEach(([k,v])=>console.log(`    ${v}x  ${k}...`));
firstCrisisQ.sort((a,b)=>a-b);
console.log(`first crisis quarter (median): Q${firstCrisisQ[Math.floor(N/2)]}`);
console.log('\nWHICH severity-3 signals drive "crisis":');
Object.entries(sig).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(4)}  ${k}`));
