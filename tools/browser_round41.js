/* browser_round41.js — round 41: the score in sight. Your wealth top left, Jenkins
   explains the goal, the pay committee says where you stand, the game-over
   screen leads with your wealth and rank, and scores post automatically.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round41.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300);
  await pg.evaluate(() => { localStorage.clear(); const n = document.getElementById('input-player-name'); if (n) n.value = 'Alexander'; UI.newGame(); UI.closeModal(); });
  for (let i = 0; i < 30 && !(await pg.evaluate(() => (GameState.inbox && GameState.inbox.items || []).some(x => /How you are scored/.test(x.title)))); i++) await wait(200);

  // 1. top left: your wealth under the company name; Jenkins explains the score
  const top = await pg.evaluate(() => { Pay.L().cash = 2.5; UI.renderAll(); const s = document.getElementById('tb-sub');
    return { t: s.textContent, tip: s.title, co: document.getElementById('tb-co').textContent, jen: (GameState.inbox.items || []).some(i => i.from === 'Jenkins' && /How you are scored/.test(i.title)) }; });
  console.log('      ' + JSON.stringify(top)); ok(/^You: \$2\.5M$/.test(top.t) && /score/.test(top.tip) && top.jen, 'top left: "' + top.co + ' / ' + top.t + '"; Jenkins: "How you are scored"');
  await pg.screenshot({ path: OUT + '/r41_top.png', clip: { x: 0, y: 0, width: 700, height: 60 } });

  // 2. the pay committee: your wealth now, right after the bonus
  const pc = await pg.evaluate(() => { const it = Pay.meeting(3); const i = it.findIndex(x => x.effect && /wealth now/.test(x.effect() || '')); return { i, n: it.length }; });
  ok(pc.i >= 1, 'pay committee: "Your wealth now" is item ' + (pc.i + 1) + ' of ' + pc.n);

  // 3. game over: the wealth headline, posted automatically, rank shown
  const go = await pg.evaluate(async () => { const store = { scores: [{ name: 'Ann', company: 'A REIT', wealth: 31.5, tsrA: 0.08, rivalsA: 0.05, ending: 'divine', endingTitle: 'Divine status', years: 15, date: '2026-10-01', v: 2 }] };
    let puts = 0; window.fetch = async (u, o) => { if (o && o.method === 'PUT') { puts++; Object.assign(store, JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; } return { ok: true, json: async () => JSON.parse(JSON.stringify(store)) }; };
    Scores.test(true); const G = GameState; G.meta.gameOver = true; G.meta.gameWon = true; G.meta.gameOverReason = 'Fifteen years.'; G._endingShown = true; Pay.L().cash = 12.3;
    UI.showGameOver(); Scores.renderGameOver(); await new Promise(r => setTimeout(r, 400));
    return { head: document.getElementById('gameover-wealth').textContent, rank: (document.getElementById('gw-rank') || {}).textContent, box: !!document.getElementById('lb2-go'), puts, n: store.scores.length, posted: G._scorePosted }; });
  ok(/YOUR WEALTH\$12\.3M/.test(go.head) && /shareholders/.test(go.head), 'game over leads with: "' + go.head.slice(0, 110) + '"');
  ok(go.posted && go.puts === 1 && go.n === 2 && /#2 on the leaderboard, of 2/.test(go.rank) && !go.box, 'posted automatically as Alexander, once: "' + go.rank + '"');
  await pg.screenshot({ path: OUT + '/r41_gameover.png' });

  // 4. the default name asks first; the title-screen board is open
  const df = await pg.evaluate(async () => { GameState._scorePosted = false; GameState.player.name = 'CEO'; Scores.renderGameOver(); await new Promise(r => setTimeout(r, 200));
    const box = !!document.getElementById('lb2-go'); await Scores.renderTitle(); const d = document.querySelector('#lb2-title details'); return { box, open: !!(d && d.open), posted: GameState._scorePosted }; });
  ok(df.box && !df.posted && df.open, 'named "CEO": asks for a name first; the title-screen leaderboard opens unfolded');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
