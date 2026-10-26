const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const order = [...fs.readFileSync(P+'/index.html','utf8').matchAll(/src="(js\/[^"]+)"/g)].map(m=>m[1]);
const dom = new JSDOM(fs.readFileSync(P+'/index.html','utf8'), { runScripts:'outside-only', url:'http://localhost/', pretendToBeVisual:true });
const w = dom.window; w.alert=()=>{}; w.fetch=()=>Promise.reject(new Error('x')); w.Element.prototype.scrollIntoView=function(){};
const noop=()=>{}; w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='canvas'?{width:300,height:150}:k==='measureText'?()=>({width:10}):k==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
w.console.log=()=>{};
for (const f of order) { try { w.eval(fs.readFileSync(P+'/'+f,'utf8')); } catch(e){ console.log('LOAD',f,e.message); } }
const html=fs.readFileSync(P+'/index.html','utf8'); w.eval(html.substring(html.lastIndexOf('<script>')+8, html.lastIndexOf('</'+'script>')));
w.UI.newGame(); const d=w.document;
d.querySelector('.tb-tab[data-view="properties"]').click();
const rows=[...d.querySelectorAll('#tMine tr.row')];
console.log('my rows:', rows.map(r=>r.querySelector('.t2').textContent).join(' | '));
for (const id of ['ind_03','ret_07','mfr_03']) {
  const r=d.querySelector(`#tMine tr.row[data-id="${id}"]`); if(!r){console.log('missing row',id);continue;}
  r.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const dr=d.querySelector(`#tMine tr.row[data-id="${id}"]`).nextElementSibling;
  const col=dr && dr.querySelectorAll('.drawer > div')[1];
  console.log(`\n[${id}] `+(col?col.textContent.replace(/\s+/g,' ').trim():'NO DRAWER'));
}
// a single-tenant building from the rest of the city
d.getElementById('restToggle').click();
const r=d.querySelector('#tRest tr.row[data-id="ind_05"]'); r.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const dr=d.querySelector('#tRest tr.row[data-id="ind_05"]').nextElementSibling;
console.log('\n[ind_05] '+dr.querySelectorAll('.drawer > div')[1].textContent.replace(/\s+/g,' ').trim());
