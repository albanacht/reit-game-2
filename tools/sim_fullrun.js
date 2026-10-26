var totalDecisions, totalQ, inboxItems, inboxKinds;
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
function boot(errs){
  const dom = new JSDOM(fs.readFileSync(P+'/index.html','utf8'), { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
  const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x'));
  w.Element.prototype.scrollIntoView=function(){};
  const noop=()=>{}; const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;
  w.console.error=(m)=>errs.push('console.error: '+String(m).slice(0,160));
  for (const f of order) { try { w.eval(fs.readFileSync(P+'/'+f,'utf8')); } catch(e){ errs.push('LOAD '+f+': '+e.message); } }
  const html=fs.readFileSync(P+'/index.html','utf8');
  try { w.eval(html.substring(html.lastIndexOf('<script>')+8, html.lastIndexOf('</'+'script>'))); } catch(e){ errs.push('inline: '+e.message); }
  try { w.UI.newGame(); } catch(e){ errs.push('newGame: '+e.message); }
  return w;
}
const RUNS=+(process.env.RUNS||20), errs=[]; let badOcc=0, defaults=0, myDefaults=0, relets=0, renewals=0, nonRenew=0, loans=0, lines=0;
let first=null;
for (let r=0;r<RUNS;r++){
  const w=boot(errs), G=w.GameState, d=w.document;
  /* 2.0 inbox: a press with a decision waiting opens it instead of running
     the quarter, so loop on quarters played, not presses. */
  let decisions=0;
  for (let press=0; press<120 && G.meta.totalQuarters<60 && !G.meta.gameOver; press++){
    try { w.UI.advanceQuarter(); } catch(e){ errs.push('advance: '+e.message); break; }
    const ov=d.getElementById('modal-overlay');
    if (ov && !ov.classList.contains('hidden') && d.querySelector('.decision-choice:not(.decision-choice-disabled)')) {
      const t=(d.getElementById('modal-title')||{}).textContent||'';
      if (/asks you for a loan/.test(t)) loans++;
      try { w.UI.makeDecision(0); decisions++; } catch(e){ errs.push('decide: '+e.message); }
      if (w.GameState._pendingDecision) errs.push('decision still pending after answering');
    }
    // invariant: single-tenant & operator buildings are exactly 0 or 1
    [].concat(G.portfolio,G.propertyMarket,G.cityRivals||[]).forEach(p=>{
      if (p.lease && w.Tenants.isLocked(p) && p.occupancy!==0 && p.occupancy!==1) badOcc++;
    });
    const ev=(G.eventLog.slice(-1)[0]||{events:[]}).events.filter(e=>e.isTenant);
    ev.forEach(e=>{ lines++; const h=e.headline;
      if(/bankruptcy/.test(h)) myDefaults++; if(/re-let|New tenants/.test(h)) relets++;
      if(/renewed/.test(h)) renewals++; if(/did not renew/.test(h)) nonRenew++;
      if(!first && r===0) first=h; });
  }
  defaults += G._defaults||0; totalDecisions=(typeof totalDecisions==='number'?totalDecisions:0)+decisions; totalQ=(typeof totalQ==='number'?totalQ:0)+G.meta.totalQuarters;
  const ib=(G.inbox||{items:[]}).items; inboxItems=(typeof inboxItems==='number'?inboxItems:0)+ib.length; inboxKinds=inboxKinds||{}; ib.forEach(i=>inboxKinds[i.kind]=(inboxKinds[i.kind]||0)+1);
  if (r===0) {
    // render the properties tab and open the first of my buildings' drawers
    try {
      w.REIT.refresh();
      const btn=d.querySelector('.tb-tab[data-view="properties"]'); if(btn) btn.click();
      const row=d.querySelector('#tMine tr.row'); if(row) row.click();
      const panel=d.querySelector('#tMine tr.dr');
      console.log('--- drawer text, first building (run 1, end state) ---');
      console.log((panel?panel.textContent:'NO DRAWER').replace(/\s+/g,' ').slice(0,420));
      console.log('--- a map card ---');
      const mk=[...d.querySelectorAll('#markers .mk')].find(m=>m.dataset.id==='ind_08');
      if (mk) { mk.onclick(); console.log(d.getElementById('card').textContent.replace(/\s+/g,' ').slice(0,200)); }
      const lot=d.querySelector('#markers .lot'); if(lot){ lot.onclick(); console.log('lot card:', d.getElementById('card').textContent.replace(/\s+/g,' ').slice(0,60)); }
      console.log('--- top tenants at end of run 1 ---');
      w.Tenants.myTopTenants().slice(0,5).forEach(t=>console.log('  '+String(t.pct).padStart(5)+'%  '+t.name+'  '+(t.coverage==null?'gov':t.coverage+'x')+' '+t.label));
    } catch(e){ errs.push('UI: '+e.message); }
  }
}
console.log(`\n=== ${RUNS} full runs through the UI ===`);
console.log(`quarters played per run: ${(totalQ/RUNS).toFixed(1)} | decisions answered per run: ${(totalDecisions/RUNS).toFixed(1)}`);
console.log(`inbox items per run: ${(inboxItems/RUNS).toFixed(0)}  by kind: ${JSON.stringify(Object.fromEntries(Object.entries(inboxKinds).map(([k,v])=>[k,+(v/RUNS).toFixed(1)])))}`);
console.log(`locked buildings not at 0% or 100%: ${badOcc}  (must be 0)`);
console.log(`tenant defaults, whole city  : ${(defaults/RUNS).toFixed(1)} per run`);
console.log(`defaults hitting YOUR rent   : ${(myDefaults/RUNS).toFixed(1)} per run`);
console.log(`your renewals / non-renewals : ${(renewals/RUNS).toFixed(1)} / ${(nonRenew/RUNS).toFixed(1)} per run`);
console.log(`your re-lettings             : ${(relets/RUNS).toFixed(1)} per run`);
console.log(`tenant news lines to you     : ${(lines/RUNS).toFixed(1)} per run`);
console.log(`support-loan decisions       : ${loans} across ${RUNS} runs`);
console.log(`first tenant line seen       : ${first}`);
console.log(`\n=== ERRORS ===\n`+(errs.length?[...new Set(errs)].slice(0,12).join('\n'):'none'));
