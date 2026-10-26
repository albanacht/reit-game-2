/* ============================================================================
   pr.js — CAMPAIGNS, SPONSORSHIPS, GALAS (round 22). window.PR

   Every year or so an opportunity lands in the inbox: a sponsorship, an
   investor day, a podcast. Pay for it and the share price gets a temporary
   lift (a premium on the fair price, like the ESG bracket, that expires).
   Some have a twist. A Head of IR brings them more often (every 3 to 4
   quarters instead of 5 to 6), 25% cheaper, and makes each lift half a
   point bigger. Lifts stack to +6% at most.
   The charity gala lives here too (Dealroom, Influence): $0.5M for +1
   political capital, once a year (board.js hostGala).
   ========================================================================== */

window.PR = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 100) / 100;
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const P = () => GameState.pr || (GameState.pr = { boosts: [], used: {}, nextQ: 5, offer: null, log: [] });
  const S = () => Story.S();
  const ir = () => !!(window.Staff && Staff.hasRole && Staff.hasRole('ir'));
  const irPerson = () => window.Staff && Staff.getStaff && Staff.getStaff('ir');
  const has = id => window.Directors && Directors.has(id);
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const MAX = 0.06;

  /* The catalogue. lift = price premium, q = quarters, twist = chance and what happens. */
  const CAMPAIGNS = [
    { id: 'marathon', title: 'Sponsor the Riverton Marathon', from: 'Riverton Running Club', cost: 0.4, lift: 0.02, q: 2,
      pitch: 'Our logo on 9,000 running shirts and the finish line. The mayor fires the starting gun.',
      after: () => { remember('hassan', 0.3, 'the marathon'); return 'Nine thousand runners in Meridian blue. Hassan ran the 10K.'; } },
    { id: 'investorday', title: 'An Investor Day in New York', from: 'Your bankers', cost: 0.6, lift: 0.03, q: 3,
      pitch: 'Two hundred fund managers, a ballroom, a slide deck, a very good lunch. Tell them the story yourself.',
      after: () => { remember('petrova', 0.5, 'the Investor Day'); return 'Standing room only. Three funds asked for a follow-up meeting.'; } },
    { id: 'ballpark', title: 'Naming rights: the Rivercats ballpark', from: 'Riverton Rivercats', cost: 1.5, lift: 0.025, q: 8,
      pitch: '"Meridian Park" for two seasons. Every home game on local TV says our name.',
      twist: { p: 0.20, lift: 0.01, text: 'The Rivercats lost 19 games in a row. The Ledger: "Meridian Park, where hope goes to die." The lift is smaller.' },
      after: () => 'The sign went up. Williams threw the first pitch. It reached the plate, eventually.' },
    { id: 'podcast', title: 'You on "The Real Estate Hour" podcast', from: 'The Real Estate Hour', cost: 0.1, lift: 0.015, q: 2,
      pitch: 'One hour, 400,000 listeners, mostly analysts on treadmills.',
      twist: { p: 0.25, lift: 0, text: 'You said "cap rate" forty-one times. Someone counted. Nobody bought shares, nobody sold any.' },
      after: () => 'Clipped, shared, and quoted in two analyst notes.' },
    { id: 'greenreport', title: 'Our first sustainability report', from: 'An ESG consultancy', cost: 0.3, lift: 0.015, q: 4,
      pitch: 'Sixty glossy pages: energy, water, a photo of a bee. ESG funds read these.',
      after: () => { remember('grace', 0.5, 'the sustainability report'); try { const e = Story.S().esg; if (e) e.base = (e.base || 0) + 4; } catch (x) {} return 'Published. ESG score +4. The bee got its own page.'; } },
    { id: 'ferry', title: 'Paint the river ferry in our colours', from: 'Riverton Ferry Co.', cost: 0.5, lift: 0.02, q: 4,
      pitch: 'The ferry crosses the river 40 times a day, under every office window downtown.',
      twist: { p: 0.15, lift: -0.01, q: 2, text: 'The ferry ran aground on a sandbar, in our colours, on the evening news. "Meridian runs aground." The price dips.' },
      after: () => 'Meridian blue, twice an hour, past every trading desk in town.' },
    { id: 'tour', title: 'A bus tour of our buildings for analysts', from: 'Your Head of IR', cost: 0.2, lift: 0.02, q: 2,
      pitch: 'Twelve analysts, one coach, our best buildings, sandwiches.',
      twistFn: () => (GameState.ratios.occupancyPortfolio || 1) < 0.88 ? { lift: -0.01, q: 2, text: 'They noticed the empty floors. One wrote "ghost town" in his notes, then in his report.' } : null,
      after: () => 'They loved the lobbies. One asked to move in.' },
    { id: 'hospital', title: 'A wing for the Children’s Hospital', from: 'Riverton Children’s Hospital', cost: 1.0, lift: 0.015, q: 6,
      pitch: 'The Meridian Wing: forty beds. The mayor will cut the ribbon, and owe you one.',
      after: () => { GameState.board.politicalCapital = Math.min(GameState.board.maxCapital || 8, (GameState.board.politicalCapital || 0) + 1); remember('williams', 0.5, 'the hospital wing'); return 'Ribbon cut. +1 political capital. Williams cried a little.'; } },
  ];

  /* The fair-price premium from campaigns running now (financials.js). */
  function premium() {
    const b = P().boosts.filter(x => tq() < x.until);
    const s = Math.max(-MAX, Math.min(MAX, b.reduce((t, x) => t + x.lift, 0)));
    return 1 + s;
  }
  const active = () => P().boosts.filter(x => tq() < x.until);

  function processQuarter(out) {
    const p = P(), now = tq();
    p.boosts = p.boosts.filter(x => now < x.until + 4);              // keep a little history
    if (S().due || now < p.nextQ || (GameState.meta.totalQuarters || 0) < 4) return out;
    const pool = CAMPAIGNS.filter(c => !p.used[c.id] && c.cost <= spendable());
    if (!pool.length) { if (Object.keys(p.used).length >= CAMPAIGNS.length) p.used = {}; return out; }
    p.offer = pool[Math.floor(rnd() * pool.length)].id;
    p.nextQ = now + (ir() ? 3 + Math.floor(rnd() * 2) : 5 + Math.floor(rnd() * 2));
    S().due = 'pr_offer';
    return out;
  }

  function run(c) {
    const p = P(), cost = fmt(c.cost * (ir() ? 0.75 : 1)), bonus = ir() ? 0.005 : 0;
    oneOff(cost); p.used[c.id] = true;
    if (window.Telemetry) Telemetry.used('campaign');
    let lift = c.lift + bonus, q = c.q, extra = '';
    const tw = c.twistFn ? c.twistFn() : (c.twist && rnd() < c.twist.p ? c.twist : null);
    if (tw) { lift = tw.lift + (tw.lift > 0 ? bonus : 0); q = tw.q || q; extra = ' ' + tw.text; }
    p.boosts.push({ id: c.id, name: c.title, lift: fmt(lift), until: tq() + q });
    p.log.push({ q: tq(), t: c.title + ' (' + money(cost) + ')' + (tw ? ': it went sideways.' : '.') }); while (p.log.length > 20) p.log.shift();
    const msg = c.after ? c.after() : '';
    return msg + extra + ' Share price ' + (lift >= 0 ? '+' : '−') + (Math.abs(lift) * 100).toFixed(1) + '% for ' + q + ' quarters.';
  }

  const CARD = { id: 'pr_offer', system: true, story: true, holdQ: 0,
    build() {
      const c = CAMPAIGNS.find(x => x.id === P().offer); if (!c) return null;
      const cost = fmt(c.cost * (ir() ? 0.75 : 1)), lift = c.lift + (ir() ? 0.005 : 0), who = irPerson();
      return { title: c.title, from: c.from, face: '',
        body: '"' + c.pitch + '"' +
              '<table class="dv-nums"><tr><td>Cost</td><td>' + money(cost) + ' (one-off)' + (ir() ? ', 25% off through your Head of IR' : '') + '</td></tr>' +
              '<tr><td>Share price</td><td>+' + (lift * 100).toFixed(1) + '% for ' + c.q + ' quarters, then it fades</td></tr>' +
              (c.twist ? '<tr><td>Risk</td><td>about ' + Math.round(c.twist.p * 10) + ' in 10 it goes sideways</td></tr>' : '') +
              (c.twistFn ? '<tr><td>Risk</td><td>if occupancy is below 88% they will notice</td></tr>' : '') + '</table>' +
              (who ? '<div class="dv"><div><b>' + who.name + ':</b> "Cheap attention is still attention."</div></div>' : '<div class="sml-note">A Head of IR would bring these more often, cheaper, and make them work harder.</div>'),
        choices: [
          { label: 'Do it: ' + money(cost), detail: '+' + (lift * 100).toFixed(1) + '% on the share price for ' + c.q + ' quarters.', check: () => spendable() >= cost, checkMsg: 'Not enough cash',
            apply() { P().offer = null; return run(c); } },
          { label: 'Pass', detail: 'Nothing happens.', apply() { P().offer = null; P().used[c.id] = true; return 'Passed. ' + (c.from || 'They') + ' will ask someone else.'; } },
        ] };
    } };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === CARD.id)) World.DECISIONS.push(CARD);

  return { premium, active, processQuarter, run, CAMPAIGNS, P };
})();
