/* check_shell.js — clicks through the 2.0 shell like a player would.
   Run: cd /tmp/t && node "<repo>/tools/check_shell.js"   (needs jsdom in /tmp/t) */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const html = fs.readFileSync(P+'/index.html','utf8');
const order = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
const errs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x'));
w.Element.prototype.scrollIntoView=function(){}; w.scrollTo=()=>{};
const noop=()=>{}; w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
w.console.log=()=>{}; w.console.error=m=>errs.push('console.error: '+String(m).slice(0,160));
w.addEventListener('error', e => errs.push('window error: '+e.message));
for (const f of order) { try { w.eval(fs.readFileSync(P+'/'+f,'utf8')); } catch(e){ errs.push('LOAD '+f+': '+e.message); } }
try { w.eval(html.substring(html.lastIndexOf('<script>')+8, html.lastIndexOf('</'+'script>'))); } catch(e){ errs.push('inline: '+e.message); }
try { w.UI.init(); } catch(e){ errs.push('UI.init: '+e.message); }   // browsers run this on DOMContentLoaded
try { w.UI.newGame(); } catch(e){ errs.push('newGame: '+e.message); }
const d = w.document, ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const visible = () => [...d.querySelectorAll('#views > .view')].filter(v=>!v.classList.contains('hidden')).map(v=>v.id);
const hud = () => d.getElementById('tb-hud').textContent.replace(/\s+/g,' ').trim();

ok(d.querySelectorAll('#topbar .tb-tab').length===5, 'five nav tabs in the top bar');
ok(!d.querySelector('#topbar .map-ctl, #topbar .seg'), 'no map view controls in the top bar');
ok(!!d.querySelector('#view-map .map-ctl'), 'map colour control lives on the map');
ok(!/jenkins/i.test(d.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,'')) || !d.querySelector('img[src*="jenkins"]'), 'no Jenkins portrait on screen');
console.log('     HUD at start: '+hud());
ok(/Cash/.test(hud()) && /Share price/.test(hud()) && /Situation/.test(hud()), 'HUD shows the core numbers');
console.log('     name/date: '+d.getElementById('tb-co').textContent+' / '+d.getElementById('tb-date').textContent);

for (const v of ['properties','finance','board','staff','map']) {
  d.querySelector('.tb-tab[data-view="'+v+'"]').click();
  const vis = visible();
  ok(vis.length===1 && vis[0]==='view-'+v && d.querySelector('.tb-tab.on').dataset.view===v, 'click '+v+' -> only view-'+v+' shown ('+vis.join(',')+')');
}
d.querySelector('.tb-tab[data-view="finance"]').click();
ok(!!d.querySelector('#view-finance #btn-issue-debt, #view-finance [onclick*="IssueDebt"], #view-finance button'), 'finance screen has capital buttons');
ok(d.getElementById('view-finance').textContent.includes('Income Statement'), 'finance screen has the income statement');

// advance through the real top-bar button
const before = d.getElementById('tb-date').textContent;
for (let i=0;i<5;i++){
  d.getElementById('btn-advance-quarter').click();
  const ov=d.getElementById('modal-overlay');
  if (ov && !ov.classList.contains('hidden') && d.querySelector('.decision-choice')) { try{ w.UI.makeDecision(0);}catch(e){errs.push('decide '+e.message);} }
  const ar=d.querySelector('.ar-footer button'); if (ar) ar.click();
  if (ov && !ov.classList.contains('hidden')) w.UI.closeModal();
}
console.log('     after 5 clicks: '+d.getElementById('tb-date').textContent+' | '+hud());
ok(d.getElementById('tb-date').textContent!==before, 'Advance button moves the calendar and HUD updates');

// property drawer actions
d.querySelector('.tb-tab[data-view="properties"]').click();
const row = d.querySelector('#tMine tr.row'); row.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const acts = [...d.querySelectorAll('#tMine .own-acts button')].map(b=>b.textContent);
console.log('     owner actions in drawer: '+acts.join(' | '));
ok(acts.includes('Sell'), 'drawer has Sell');
d.querySelector('#tMine .own-acts button[data-v1="sell"]').click();
ok(!d.getElementById('modal-overlay').classList.contains('hidden') && /Sell/.test(d.getElementById('modal-title').textContent), 'Sell opens the confirm dialog: '+d.getElementById('modal-title').textContent);
w.UI.closeModal();
const buy = d.querySelector('#tMarket button[data-v1="buy"], #tab-properties button[data-v1="buy"]');
if (buy) { buy.click(); ok(/^Buy /.test(d.getElementById('modal-title').textContent), 'Buy opens the acquire dialog: '+d.getElementById('modal-title').textContent); w.UI.closeModal(); }
else console.log('     (no building listed for sale right now)');

console.log(errs.length ? '\nERRORS:\n  '+[...new Set(errs)].join('\n  ') : '\nno errors');
