/* ============================================================================
   port.js — STORY 7: PORT LOGISTICS (round 16). window.Port

   Wexmoor's best building: Port Logistics Center, let to Atlas Cold Chain for
   15 years, 7.4% in a 6.5% market. Eleanor Whitcombe will never sell it to
   us. Unless she has to.

   Act 1  a meeting, Years 4 to 8: Chen proposes the scheme, Tex backs him.
          Atlas runs ammonia refrigeration; the mayor's fire marshal
          "re-inspects" and finds violations; Nora gets a tip; Atlas
          threatens to leave; Eleanor's lenders get nervous; she sells fast.
          Through the mayor (2 political capital) or Tex's people (1).
   Act 2  a quarter or two later: she sells at 15% off / she holds / it leaks.
          A failure costs Chen (and Tex, if he backed it) reputation; below 30
          at the meeting they are out (directors.js).
   Act 3  the lawsuit (Wexmoor: $12M for interfering with its tenant), at the
          next meeting: settle $6M / fight it (half and half) / blame the
          director who started it.
   Later  for three years after we buy it, 1 in 10 a year the emails come out.
          A year after Act 1, the mayor wants $0.5M for his campaign.
   ========================================================================== */

window.Port = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const ID = 'ind_02', NAME = 'Port Logistics Center', TID = 'atlas_cold_chain';
  const ELEANOR = { name: 'Eleanor Whitcombe', face: FACE('ceo_wex'), role: 'CEO, Wexmoor' };
  const MAYOR = { name: 'Mayor Frank Kowalczyk', face: FACE('mayor'), role: 'Mayor of Riverton' };
  const NORA = 'Nora Whitlock', PAPER = 'Riverton Ledger';

  function P() {
    const s = Story.S();
    if (!s.port) s.port = { stage: 'wait', log: [] };
    return s.port;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const spendPC = n => { GameState.board.politicalCapital = Math.max(0, cap() - n); };
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const price = f => { GameState.company.sharePrice = fmt(GameState.company.sharePrice * f); };
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const rep = (id, d, why) => { if (has(id) && Directors.repChange) Directors.repChange(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const voice = (id, text) => !has(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + Directors.name(id).replace(/^(Chairman|Chair|Director) /, '') + ':</b> ' + text + '</div></div>';
  const note = t => P().log.push({ q: tq(), t });
  const bldg = () => (GameState.cityRivals || []).concat(GameState.portfolio || [], GameState.propertyMarket || []).find(p => p.id === ID) || null;
  const mine = () => (GameState.portfolio || []).some(p => p.id === ID);
  const wexOwns = () => { const b = bldg(); return !!b && b.owner === 'wex' && GameState.rivals && GameState.rivals.wex && !GameState.rivals.wex.gone; };
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const offerPrice = () => { const b = bldg(); return b ? fmt(b.currentValue * 0.85) : 0; };
  const backers = () => ['chen'].concat(P().texBacked ? ['tex'] : []).filter(has);

  /* Odds by route. A Head of IR keeps it quieter; Voss on our board talks to Kessler, and Kessler loves a scandal. */
  function odds(route) {
    let leak = route === 'tex' ? 0.10 : 0.20, sell = route === 'tex' ? 0.55 : 0.50;
    if (window.Staff && Staff.hasRole && Staff.hasRole('ir')) leak -= 0.05;
    if (has('voss')) leak += 0.10;
    leak = clamp(leak, 0.03, 0.5);
    if (window.Agents) leak = Agents.risk('port', leak);   // round 22: someone on the case
    return { sell, leak, hold: fmt(1 - sell - leak) };
  }
  const tenths = p => Math.max(1, Math.round(p * 10)) + ' in 10';

  // ============================================================================
  // THE MEETING
  // ============================================================================
  function agenda(year, items) {
    const p = P(); items = items || [];
    // Act 1: Chen's item. Never at a meeting that already has a big cheque on it.
    const busy = items.some(it => ['story_harlow_offer', 'story_harlow_loan'].indexOf(it.card) > -1 || /Morrow Plaza|Celestial Heights\. /.test(JSON.stringify(it.lines || [])));
    const ready = (GameState.balance.totalAssets || 0) >= offerPrice() * 3 || year >= 8;
    if (p.stage === 'wait' && year >= 4 && year <= 9 && ready && !busy && wexOwns() && has('chen')) {
      p.stage = 'pitched'; p.year = year;
      const b = bldg(), o1 = odds('mayor'), o2 = odds('tex'), t = GameState.tenants && GameState.tenants[TID];
      const lines = [['chen', NAME + ' is pure gold. Atlas Cold Chain on a fifteen year lease, rent up 3% a year, ' + (b.annualNOI / b.currentValue * 100).toFixed(1) + '% in a 6.5% market. And it is sitting with that witch Eleanor, who will never sell it to us. Unless she has to.'],
                     ['chen', 'Atlas runs ammonia refrigeration. The fire code takes ammonia very seriously. Frank’s fire marshal re-inspects, finds violations, Nora gets a tip about "ammonia risk at the port". Atlas threatens to leave, Eleanor’s lenders get nervous, and she sells to whoever can close fast. Once it is ours, Frank sorts out the violations.']];
      if (has('tex')) lines.push(['tex', 'I’ll back that. Frank and I go way back. My people can make the calls so it never touches this office.']);
      lines.push(['okafor', 'You are describing a smear campaign.'], ['petrova', 'If this leaks, it is our name in the paper, not hers.']);
      const choices = [
        { label: 'Do it through the mayor (2 political capital)', detail: 'About ' + tenths(o1.sell) + ' she sells to us at 15% off (about ' + money(offerPrice()) + '), ' + tenths(o1.hold) + ' she holds, ' + tenths(o1.leak) + ' it leaks. If it fails, Chen’s reputation suffers' + (has('tex') ? ', and Tex’s for backing him' : '') + '. You have ' + cap() + '.',
          disabled: cap() < 2, why: 'Needs 2 political capital', go: () => start('mayor') },
      ];
      if (has('tex')) choices.push({ label: 'Do it through Tex’s people (1 political capital)', detail: 'Quieter: about ' + tenths(o2.sell) + ' she sells, ' + tenths(o2.hold) + ' she holds, only ' + tenths(o2.leak) + ' it leaks. Tex’s name is on it now: if it fails, his reputation and Chen’s both suffer.',
        disabled: cap() < 1, why: 'Needs 1 political capital', go: () => start('tex') });
      choices.push({ label: 'No', detail: 'Chen −1' + (has('tex') ? ', Tex −1' : '') + ', Okafor +1. Eleanor never knows how close it came.',
        go: () => { p.stage = 'declined'; remember('chen', -1, 'you would not go after Port Logistics'); remember('tex', -1, 'you passed on his favour'); remember('okafor', 1, 'no smear campaign'); return 'Chen closed his folder. "Your call."'; } });
      items.push({ lines, choices, note: NAME + ': worth about ' + money(b.currentValue) + ', Atlas pays ' + money(b.annualNOI) + ' a year' + (t ? ' (rent cover ' + t.coverage + 'x, steady as a rock)' : '') + '.' });
      return items;
    }
    // Act 3: the lawsuit
    if (p.stage === 'suit' && p.suitYear !== year) { p.suitYear = year; items.push(suitItem()); }
    return items;
  }
  function start(route) {
    const p = P(), o = odds(route);
    p.route = route; p.texBacked = has('tex'); p.stage = 'scheme'; p.q0 = tq(); p.resultQ = tq() + rint(1, 2); p.odds = o;
    spendPC(route === 'tex' ? 1 : 2);
    remember('chen', 1, 'you backed his plan for Port Logistics'); if (p.texBacked) remember('tex', 1, 'you backed the Port Logistics plan');
    remember('okafor', -1, 'the Port Logistics scheme'); remember('petrova', -0.5, 'the Port Logistics scheme');
    if (GameState.rivals && GameState.rivals.wex) GameState.rivals.wex.price = fmt(GameState.rivals.wex.price * 0.97);
    note('The scheme began (' + route + ').');
    return route === 'tex' ? 'Tex stepped out to make a call. "Done, partner."' : 'You called Frank. He laughed for a long time, then said "leave it with me".';
  }

  function suitItem() {
    const p = P(), blame = p.route === 'tex' && has('tex') ? 'tex' : 'chen', bn = Directors.name(blame).replace(/^(Director|Chair) /, '');
    return { guest: ELEANOR, lines: [['guest', 'Wexmoor is suing you for interfering with our tenant. Twelve million dollars. I have the emails, and so does the Ledger. See you in court, or see me with a cheque.'],
                                      ['okafor', 'I said this would happen. It is in the minutes.']],
      choices: [
        { label: 'Settle: $6M', primary: true, detail: 'Paid as a one-off cost. Petrova −1, share price −2%. The story dies in a week.',
          go: () => { oneOff(6); price(0.98); remember('petrova', -1, 'the Wexmoor settlement'); p.stage = 'settled'; p.ending = 'settled'; note('Settled with Wexmoor.'); return 'Settled. Eleanor did not shake your hand.'; } },
        { label: 'Fight it in court', detail: 'Half the time we win and Wexmoor pays our legal costs. The other half: $12M plus $2M of lawyers, share price −5%, and the mayor faces an investigation (you lose him as a contact).',
          go: () => { if (rnd() < 0.5) { p.stage = 'won'; p.ending = 'won'; remember('chen', 1, 'we won the Wexmoor case'); note('Won the Wexmoor case.'); return 'The judge found the emails "suggestive but not conclusive". We win. Wexmoor pays our costs.'; }
            oneOff(14); price(0.95); p.mayorLost = true; p.mayor = false; backers().forEach(id => rep(id, -10, 'we lost the Wexmoor case')); p.stage = 'lost'; p.ending = 'lost'; remember('petrova', -1.5, 'we lost the Wexmoor case'); note('Lost the Wexmoor case.');
            return 'We lost. $12M to Wexmoor and $2M to our lawyers. The state has opened an investigation into the mayor’s office.'; } },
        { label: 'Blame ' + bn + ': "a director acting alone"', detail: bn + '’s reputation −35: at the next meeting he is probably off the board. Settle for $3M. He never forgives you.',
          go: () => { rep(blame, -35, 'you blamed him for the Port Logistics scheme'); if (window.Directors) Directors.bond(blame, -3, 'you threw him under the bus'); remember(blame, -3, 'you blamed him for Port Logistics'); oneOff(3); p.stage = 'blamed'; p.ending = 'blamed'; p.blamed = blame; note('Blamed ' + blame + '.');
            return 'Our statement says ' + bn + ' acted alone. Wexmoor settled for $3M. ' + bn + ' read it in the paper.'; } },
      ] };
  }

  // ============================================================================
  // BETWEEN MEETINGS
  // ============================================================================
  function processQuarter(out) {
    const p = P(), s = Story.S(), now = tq(), G = GameState;
    if (G.meta.gameOver) return;
    // the mayor's favour, once a year after Act 1
    if (p.q0 && !p.favourAsked && now >= p.q0 + 4 && !p.mayorLost && !s.due) { p.favourAsked = true; s.due = 'port_mayor'; }
    if (p.mayor && G.meta.quarter === 1 && p.pcYear !== G.meta.year) { p.pcYear = G.meta.year; G.board.politicalCapital = Math.min(G.board.maxCapital || 8, cap() + 1); out.push({ good: true, text: 'Mayor Kowalczyk remembers his friends: +1 political capital.' }); }
    // Act 2: the result
    if (p.stage === 'scheme' && now >= p.resultQ) {
      if (!wexOwns()) { p.stage = 'declined'; return; }
      const r = rnd(), o = p.odds;
      if (r < o.leak) return leak(out, false);
      if (r < o.leak + o.sell) { if (s.due) { p.resultQ = now + 1; return; } p.stage = 'offer'; s.due = 'port_offer'; return; }
      p.stage = 'held'; p.ending = 'held';
      backers().forEach(id => rep(id, -15, 'the Port Logistics scheme failed'));
      say(ELEANOR.name, ELEANOR.role, 'Nice try', 'Fixed the ammonia system. Two million dollars, which I will remember. Atlas has renewed for twenty years.<br><br>Nice try. Love to Frank.<br>E.', ELEANOR.face);
      out.push({ good: false, text: 'Eleanor fixed the ammonia system and kept Port Logistics. Chen’s reputation −15' + (p.texBacked && has('tex') ? ', Tex’s too' : '') + '.' });
      note('Eleanor held.');
    }
    // years after we bought it: the emails can still come out
    if (p.stage === 'owned' && G.meta.quarter === 4 && p.lateYear !== G.meta.year && G.meta.year <= (p.boughtYear || 0) + 3) {
      p.lateYear = G.meta.year;
      if (rnd() < (window.Agents ? Agents.risk('port', 0.10) : 0.10)) leak(out, true);
    }
  }
  function leak(out, late) {
    const p = P();
    price(0.96); p.stage = 'suit'; p.leaked = true;
    backers().forEach(id => rep(id, -25, 'the Port Logistics emails'));
    say(NORA, 'Reporter, ' + PAPER, 'REIT and mayor targeted rival’s building', 'Today’s Ledger prints an email between our office and City Hall about the fire inspection at ' + NAME + '. "Make it stick until Eleanor blinks." Share price −4%. Wexmoor’s lawyers have already called.', FACE('journalist'));
    out.push({ good: false, text: 'The Port Logistics emails are in the Ledger' + (late ? ', years after the deal' : '') + '. Share price −4%. Wexmoor is suing.', w: 10 });
    note('It leaked.');
  }

  // ============================================================================
  // THE CARDS
  // ============================================================================
  const CARDS = [
    { id: 'port_offer', system: true, story: true,
      build() {
        const p = P(), b = bldg(); if (p.stage !== 'offer' || !b || !wexOwns()) return null;
        const px = offerPrice(), fee = Properties.transactionFee ? Properties.transactionFee(px) : 0;
        return { title: 'Eleanor is selling ' + NAME, from: ELEANOR.name + ', ' + ELEANOR.role, face: ELEANOR.face,
          body: '"Quietly, fast, ' + money(px) + '. My lenders want it gone this quarter, and I hear you can close. I also hear you have friends at City Hall. I hope they are worth it."' +
                nums([['Price', money(px) + ' (15% under its ' + money(b.currentValue) + ' value)'], ['Rent', money(b.annualNOI) + ' a year from Atlas Cold Chain, 15 year lease'], ['Your yield', (b.annualNOI / px * 100).toFixed(1) + '%'], ['Your cash plus credit line', money(spendable())]]) +
                voice('chen', '"Buy it today."'),
          choices: [
            { label: 'Buy it: ' + money(px), check: () => spendable() >= px + fee, checkMsg: 'Not enough cash plus credit line',
              apply() { World.buyAt(b, px); p.stage = 'owned'; p.boughtYear = GameState.meta.year; p.ending = 'owned'; b.vb = null; remember('chen', 1, 'we got Port Logistics'); if (p.texBacked) remember('tex', 1, 'we got Port Logistics'); rep('chen', 5, 'Port Logistics'); note('Bought Port Logistics.');
                      return NAME + ' is ours. Next quarter the fire marshal finds that everything is, in fact, fine.'; } },
            { label: 'Walk away', detail: 'The political capital is spent. Chen −1.', apply() { p.stage = 'walked'; p.ending = 'held'; remember('chen', -1, 'you walked away from Port Logistics'); return 'Eleanor kept it after all. She sent a fruit basket with a smoke detector in it.'; } },
          ] };
      } },
    { id: 'port_mayor', system: true, story: true,
      build() {
        const p = P(); if (p.mayorLost) return null;
        return { title: 'The mayor would like a word', from: MAYOR.name, face: MAYOR.face,
          body: '"I helped you. Election’s in March. There is a civic fund, very respectable, that supports good government in Riverton. Half a million would show you believe in good government."' +
                voice(lead('petrova', 'okafor'), '"That is a campaign donation with a bow on it."'),
          choices: [
            { label: 'Pay the civic fund: $0.5M', detail: 'A one-off cost. Frank stays a friend: +1 political capital every year.', apply() { oneOff(0.5); p.mayor = true; note('Paid the mayor’s fund.'); return 'Frank sent a signed photo of himself.'; } },
            { label: 'Refuse', detail: 'Frank goes cold. The fire marshal starts visiting your buildings instead: one of them loses 3 points of occupancy.',
              apply() { p.mayorCold = true; const t = (GameState.portfolio || []).filter(x => !x.underConstruction && !x.storyLock && !(window.Tenants && Tenants.isLocked(x))).sort((a, b) => b.occupancy - a.occupancy)[0];
                        if (t) t.occupancy = Math.max(0.3, fmt(t.occupancy - 0.03)); note('Refused the mayor.'); return 'Frank said "I understand". The fire marshal visited ' + (t ? t.name : 'one of our buildings') + ' on Tuesday.'; } },
          ] };
      } },
  ];
  /* round 17: every big cheque can be paid with preferred shares (financials.js prefChoice) */
  const withPref = (c, amt) => { const b = c.build; c.build = function () { const k = b.apply(this, arguments);
    if (k && k.choices && k.choices[0] && window.Financials && Financials.prefChoice) { const a = amt(); if (a > 0) { const pc = Financials.prefChoice(k.choices[0], a, { why: k.title }); k.choices.splice(1, 0, pc); if (Financials.splitChoice) k.choices.splice(2, 0, Financials.splitChoice(k.choices[0], a, { why: k.title }));   /* round 27: or split it */ k.body = (k.body || '') + Financials.prefDebateHTML(pc.rate); } } return k; }; };
  CARDS.forEach(c => { if (c.id === 'port_offer') withPref(c, () => offerPrice() + (Properties.transactionFee ? Properties.transactionFee(offerPrice()) : 0)); });
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* The ending card (ending.js). */
  function ending() {
    const p = P();
    if (p.stage === 'wait' || p.stage === 'declined' || !p.stage) return 'none';
    if (p.stage === 'scheme' || p.stage === 'offer') return 'pending';
    return p.ending || p.stage;
  }
  function debug(o) { Object.assign(P(), o || {}); return P(); }

  return { P, agenda, processQuarter, ending, odds, debug, NAME };
})();
