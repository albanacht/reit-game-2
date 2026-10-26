/* browser_round30.js — round 30: Gary's old yard (an insider sale: +5/15/30%,
   lobbying, the vote, the yard on your books, your half of the premium, Nora
   finding it, the ending card) and Alexander Crow on s10.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round30.js" [outdir] */
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
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1300);
  const a = await pg.evaluate(() => { const G = GameState; UI.closeModal(); for (let i = 0; i < 4; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    G.meta.year = 9; G.balance.cash = 200; const r0 = Math.random; Math.random = () => 0.1; Story.S().due = null; Gary.processQuarter([]); Math.random = r0;
    const y = Gary.Y(), due = Story.S().due, c = World.systemDecision();
    return { stage: y.stage, due, value: y.value, labels: c.choices.map(x => x.label), body: c.body.replace(/<[^>]+>/g, ' ').slice(0, 220), odds: [Gary.yardOdds(0.05), Gary.yardOdds(0.15), Gary.yardOdds(0.15, true), Gary.yardOdds(0.30), Gary.yardOdds(0.30, true)].map(x => Math.round(x * 100)) }; });
  ok(a.stage === 'offer' && a.due === 'gary_yard' && a.labels.length === 6, 'Year 9: Gary’s offer (' + a.value + 'M): ' + a.labels.join(' | '));
  ok(!a.labels.some(l => /\+0%|at value/.test(l)) && a.odds[2] > a.odds[1] && a.odds[0] > a.odds[3], 'premiums +5/15/30 only; board odds ' + a.odds.join('/') + '% (lobbying helps)');
  console.log('      ' + a.body);
  const s = await pg.evaluate(() => { const G = GameState, w0 = Pay.wealth().total, pc0 = G.board.politicalCapital = 5, c = World.systemDecision();
    const r0 = Math.random; Math.random = () => 0.01; const i = c.choices.findIndex(x => /\+30%.*lobby/.test(x.label)); const m = World.applyChoice(c, i); Math.random = r0; Story.S().due = null;
    const p = G.portfolio.find(x => x.id === 'ind_rsv'), y = Gary.Y();
    return { m: m.message, own: !!p, val: p && p.currentValue, paid: p && p.purchasePrice, ten: p && p.lease.positions[0].t, wealth: Pay.wealth().total - w0, pc: G.board.politicalCapital, y }; });
  ok(s.own && s.paid > s.val && s.ten === 'riverside_salvage', 'approved at +30% with lobbying: "' + s.m + '"');
  ok(Math.abs(s.wealth - (s.paid - s.val) / 2) < 0.05 && s.pc === 3, 'your half of the premium: +$' + s.wealth.toFixed(2) + 'M; political capital 5 → ' + s.pc);
  const l = await pg.evaluate(() => { const G = GameState, px = G.company.sharePrice, p0 = Directors.card('petrova').memory.length; Gary.yardLeak([]);
    const pet = Directors.card('petrova').memory.join(' | '), ok2 = Directors.card('okafor').memory.join(' | '); const t = G.inbox.items.slice(-1)[0];
    return { px0: px, px1: G.company.sharePrice, pet, ok2, title: t.title, flagged: Gary.flagged(), card: Ending.cards().find(c => c.label === 'The old yard') }; });
  ok(l.px1 < l.px0 && /scrap yard/.test(l.pet) && /scrap yard/.test(l.ok2) && l.flagged, 'Nora finds it: "' + l.title + '"; price ' + l.px0 + ' → ' + l.px1 + '; Petrova and Okafor remember; flagged for say on pay');
  ok(l.card && /page one/.test(l.card.lines[0]), 'ending card: ' + (l.card && l.card.lines.join(' ')));
  const c = await pg.evaluate(() => { const riv = Rivals.R ? ['wex', 'ren', 'hal'].flatMap(k => (Rivals.R(k) || { staff: [] }).staff).find(x => x.portrait === 's10.jpg') : null;
    if (riv) return ['rival: ' + riv.name];                     // a rival hired him first: he is not on the market
    const n = []; for (let i = 0; i < 400; i++) { const x = Staff.generateCandidate('cfo', []); if (x.portrait === 's10.jpg') n.push(x.name); } return [...new Set(n)]; });
  ok(c.length === 1 && /Alexander Crow/.test(c[0]), 's10 is always ' + c.join(', '));
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
