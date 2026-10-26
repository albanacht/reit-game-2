/* browser_round27.js — round 27: bonds run 7 years at most; preferred shares
   only pay what cash cannot (cap 20% of assets); a story deal can be split
   half bonds, half preferred shares, with the bondholders waiving the covenant
   for that deal if they must.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round27.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1300);
  await pg.evaluate(() => { UI.closeModal(); for (let i = 0; i < 4; i++) { Financials.runQuarter(); Story.S().due = null; GameState._pendingDecision = null; } });

  const t = await pg.evaluate(() => { const G = GameState, opts = [...document.querySelectorAll('#input-debt-years option')].map(o => +o.value);
    G.company.debtIssuanceQuarter = 0; const r = Financials.issueDebt(5, 10, false); const tr = G.debtTranches[G.debtTranches.length - 1];
    return { max: Math.max(...opts), label: tr.label, yrs: tr.maturityYear - G.meta.year, msg: r.message }; });
  ok(t.max === 7 && t.yrs === 7, 'bonds: longest option ' + t.max + ' years; asking for 10 gives ' + t.yrs + ' ("' + t.label + '")');

  const p = await pg.evaluate(() => { const G = GameState; G.balance.cash = 200;
    const pc = Financials.prefChoice({ label: 'Buy it', detail: 'x', apply: () => 'done' }, 50, { why: 'test' });
    return { check: pc.check(), msg: pc.checkMsg, cap: Financials.prefRoom(), assets: G.balance.totalAssets }; });
  ok(!p.check && /have the cash/.test(p.msg), 'with $200M in hand, preferred shares are not offered: "' + p.msg + '"');
  ok(Math.abs(p.cap - p.assets * 0.2) < 1, 'preferred room: 20% of assets ($' + p.cap + 'M of $' + p.assets + 'M)');

  const s = await pg.evaluate(() => { const G = GameState; G.balance.cash = 5; const room = Financials.debtRoom().secured, cov = Financials.covenantLimit();
    const amt = Math.round(room + 60), plan = Financials.splitPlan(amt), d0 = G.debtTranches.length, p0 = (G.preferred && G.preferred.outstanding) || 0;
    const sc = Financials.splitChoice({ label: 'Buy it', detail: 'the building is ours.', apply: () => 'Bought.' }, amt, { why: 'test deal' });
    const ok1 = sc.check(), m = sc.apply(); const tr = G.debtTranches.slice(d0);
    return { amt, room: Math.round(room), plan, label: sc.label, detail: sc.detail, ok1, m, deal: tr.map(x => x.label + ' $' + x.amount).join(', '), pref: ((G.preferred && G.preferred.outstanding) || 0) - p0,
             okafor: Directors.card('okafor').memory.join(' | ') }; });
  ok(s.ok1 && Math.abs(s.plan.bond - s.plan.pref) < 1 || s.plan.pref < s.plan.shortBy / 2, 'split $' + s.plan.shortBy + 'M: $' + s.plan.bond + 'M bonds + $' + s.plan.pref + 'M preferred');
  ok(s.plan.over > 0 && /waive/.test(s.detail) && /Deal Notes/.test(s.deal), 'past the covenant ($' + s.room + 'M of room): the bondholders waive it; ' + s.deal + ', fee $' + s.plan.fee + 'M');
  ok(/borrowed past the covenant/.test(s.okafor), 'Okafor remembers: "' + s.okafor.slice(0, 80) + '"');
  console.log('      ' + s.m.slice(0, 260));

  const h = await pg.evaluate(() => { const G = GameState; G.balance.cash = 5; Story.debug('offer', { due: 'story_harlow_offer' });
    const c = World.systemDecision(); return { labels: c ? c.choices.map(x => x.label) : [], body: c ? c.body.replace(/<[^>]+>/g, ' ') : '' }; });
  ok(h.labels.some(l => /Half bonds, half preferred/.test(l)), 'Bob’s offer can be split: ' + h.labels.join(' | '));
  ok(/split it: half bonds/.test(h.body), 'and someone at the table suggests it');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
