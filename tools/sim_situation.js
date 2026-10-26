const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
function boot(){
  const dom = new JSDOM(fs.readFileSync(P+'/index.html','utf8'), { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
  const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x'));
  w.Element.prototype.scrollIntoView=function(){};
  const noop=()=>{}; const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;
  for (const f of order) { try { w.eval(fs.readFileSync(P+'/'+f,'utf8')); } catch(e){ console.log('LOAD FAIL',f,e.message); } }
  try { w.UI.newGame(); } catch(e){}
  return w;
}

// --- A: one narrated run -----------------------------------------------------
console.log('=== ONE RUN, NARRATED (every 4th quarter) ===');
let w = boot();
for (let q=1; q<=60; q++){
  try { w.Financials.runQuarter(); } catch(e){ console.log('  stopped:', e.message); break; }
  if (w.GameState.meta.gameOver) { console.log(`  Y${w.GameState.meta.year} run ended`); break; }
  if (q % 4 === 0) {
    const s = w.Situation.get();
    console.log(`Y${w.GameState.meta.year}  ${s.label.padEnd(12)} trend:${s.trend.dir.padEnd(14)} ${w.Situation.describe()}`);
  }
}

// --- B: does the distribution make sense across many runs? -------------------
console.log('\n=== 25 RUNS — where does the company actually live? ===');
const dist={}, byYr={};
for (let r=0;r<25;r++){
  const ww = boot();
  for (let q=1;q<=60;q++){
    try { ww.Financials.runQuarter(); } catch(e){ break; }
    if (ww.GameState.meta.gameOver) break;
    const st = ww.Situation.get().state, y = ww.GameState.meta.year;
    dist[st]=(dist[st]||0)+1;
    byYr[y]=byYr[y]||{}; byYr[y][st]=(byYr[y][st]||0)+1;
  }
}
const tot=Object.values(dist).reduce((a,b)=>a+b,0);
['crisis','distress','stable','opportunity','overheated'].forEach(k=>
  console.log(`  ${k.padEnd(12)} ${String(Math.round((dist[k]||0)/tot*100)).padStart(3)}%`));
console.log('\n  early (Y1-5) vs late (Y11-15):');
const band=(a,b)=>{const o={};for(let y=a;y<=b;y++)Object.entries(byYr[y]||{}).forEach(([k,v])=>o[k]=(o[k]||0)+v);
  const t=Object.values(o).reduce((x,y)=>x+y,0)||1;
  return ['crisis','distress','stable','opportunity','overheated'].map(k=>`${k.slice(0,4)} ${Math.round((o[k]||0)/t*100)}%`).join('  ');};
console.log('   Y1-5 :', band(1,5));
console.log('   Y11-15:', band(11,15));
