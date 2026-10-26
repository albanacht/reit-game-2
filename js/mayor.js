/* ============================================================================
   mayor.js — STORY 8: THE MAYOR'S FLOORS (round 33). window.Mayor

   Year 12. City Hall's lease is up and Mayor Frank Kowalczyk (the same Frank
   as the Port Logistics story) needs four floors for city departments. He
   wants them in Celestial Heights, pre-let while it is still being built (or
   in the tower if it is open and not full; without a tower, in our emptiest
   office building). The city takes about 15% of the building.

   The offer (one inbox card):
     clean       the city's budget rent, 15% under market, for 15 years.
                 Safe; the tower opens fuller and can reach trophy status.
     sweetheart  rent 20% ABOVE market (taxpayers' money); the company gives
                 $0.5M to his campaign and he holds his fundraiser in the sky
                 lounge. Exposure risk for the company.
     skim        market rent; the fit-out goes to his cousin's firm at a $5M
                 markup, $3M of it comes back to you as "speaking fees".
                 Exposure risk for you personally. Lobbying (2 political
                 capital) halves the odds.
     refuse      no lease. Floors are left for the market.
   One investigation, 4 to 6 quarters later, settles all four:
     clean       nothing to see
     sweetheart  if found (40%): the council cuts the rent to market, price
                 −4%, the board remembers (Petrova and Okafor most)
     skim        if found (40%, 20% lobbied): a court fine of 2.5x what you
                 took ($7.5M), paid from your own money; price −3%; the board
                 remembers. You are NOT fired for it (the board may still vote
                 you out at the meeting if they were close already).
     refuse      the Ledger: "the only landlord who said no". +2 political
                 capital, Okafor and Petrova think better of you for good,
                 price +2%. If the mayor took his floors to Rennick instead,
                 the scandal lands on Kessler (his shares −12%).
   A Port scheme run through Frank adds 10 points to the exposure odds: Nora
   already has a file. If the Port lawsuit was lost, Frank is gone and there
   is no story.
   ========================================================================== */

window.Mayor = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + (Math.abs(n) >= 10 ? Math.abs(n).toFixed(0) : Math.abs(n).toFixed(1)) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const FRANK = { name: 'Mayor Frank Kowalczyk', face: FACE('mayor'), role: 'Mayor of Riverton' };
  const NORA = 'Nora Whitlock', PAPER = 'Riverton Ledger';
  const SHARE = 0.15, CLEAN = 0.85, SWEET = 1.20, DONATION = 0.5, SKIM = 3, MARKUP = 5, FINE_X = 2.5;
  const BASE_ODDS = 0.40, PORT_ODDS = 0.10, LOBBY_CUT = 0.5, LOBBY_PC = 2;
  const TOWER = 'off_cel';

  function M() {
    const s = Story.S();
    if (!s.mayor) s.mayor = { stage: 'wait', log: [] };
    return s.mayor;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const price = f => { GameState.company.sharePrice = fmt(GameState.company.sharePrice * f); };
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const me = () => Pay.L();
  const note = t => M().log.push({ q: tq(), t });
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const voice = (id, text) => !has(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + Directors.name(id).replace(/^(Chairman|Chair|Director) /, '') + ':</b> ' + text + '</div></div>';
  const port = () => (window.Port && Port.P) ? Port.P() : {};
  const rennick = () => { const r = GameState.rivals && GameState.rivals.ren; return r && !r.gone ? r : null; };

  /* Where the city's floors would go. */
  function target() {
    const G = GameState, t = window.Tower ? Tower.T() : {}, tw = (G.portfolio || []).find(p => p.id === TOWER);
    if (tw && t.stage === 'build') return { p: tw, pre: true };                                  // pre-let while it is built
    if (tw && !tw.underConstruction && tw.occupancy < 0.9) return { p: tw, pre: false };
    const off = (G.portfolio || []).filter(p => p.sector === 'office' && !p.underConstruction && !p.storyLock && p.occupancy < 0.88 &&
                                               !(window.Tenants && Tenants.isLocked && Tenants.isLocked(p))).sort((a, b) => a.occupancy - b.occupancy)[0];
    return off ? { p: off, pre: false } : null;
  }
  const odds = lobby => clamp((BASE_ODDS + (port().route === 'mayor' ? PORT_ODDS : 0)) * (lobby ? LOBBY_CUT : 1), 0.05, 0.9);
  const tenths = p => Math.max(1, Math.round(p * 10)) + ' in 10';

  // ============================================================================
  // EVERY QUARTER (story.js)
  // ============================================================================
  function processQuarter(out) {
    const m = M(), G = GameState, s = Story.S();
    if (G.meta.gameOver) return;
    if (m.stage === 'wait') {
      if (G.meta.year < 12 || G.meta.year > 13) return;
      if (port().mayorLost) { m.stage = 'none'; note('Frank is gone: no story.'); return; }
      if (s.due && !(Story.lowDue && Story.lowDue())) return;
      if (!(rnd() < 0.5 || G.meta.quarter >= 3 || G.meta.year === 13)) return;
      const T = target(); if (!T) { if (G.meta.year === 13 && G.meta.quarter === 4) m.stage = 'none'; return; }
      Object.assign(m, { stage: 'offer', bld: T.p.id, pre: T.pre }); s.due = 'mayor_offer';
      return;
    }
    if (m.stage === 'done' && m.invQ && tq() >= m.invQ && !m.invDone) investigation(out);
  }

  /* The lease: the city takes SHARE of the building at mult × market rent. */
  function lease(mult) {
    const m = M(), p = (GameState.portfolio || []).find(x => x.id === m.bld); if (!p) return;
    m.share = SHARE; m.mult = mult;
    if (p.id === TOWER && window.Tower && Tower.T().stage === 'build') { Tower.T().city = { share: SHARE, mult }; return; }   // tower.js applies it when it opens
    const add = Math.min(SHARE, Math.max(0, 0.97 - p.occupancy));
    p.occupancy = fmt(p.occupancy + add);
    p.annualNOI = fmt(p.annualNOI * (1 + add * (mult - 1)));
    m.share = add;
    if (p.id === TOWER && window.Tower) Tower.T().city = { share: add, mult, applied: true };
  }
  /* The council cuts the city's rent back to market. */
  function cutRent() {
    const m = M(), p = (GameState.portfolio || []).find(x => x.id === m.bld), t = window.Tower ? Tower.T() : null;
    if (t && t.city && !t.city.applied && t.stage === 'build') { t.city.mult = 1; m.mult = 1; return; }
    if (p && m.mult && m.mult !== 1) { p.annualNOI = fmt(p.annualNOI / (1 + m.share * (m.mult - 1))); if (t && t.city) t.city.mult = 1; m.mult = 1; }
  }

  function decide(choice, lobby) {
    const m = M();
    m.choice = choice; m.lobby = !!lobby; m.stage = 'done'; m.q = tq(); m.invQ = tq() + rint(4, 6); m.odds = odds(lobby);
    const p = (GameState.portfolio || []).find(x => x.id === m.bld), name = p ? p.name : 'the building';
    if (choice === 'clean') {
      lease(CLEAN); remember('williams', m.bld === TOWER ? 1 : 0.5, 'City Hall rents four floors'); remember('okafor', 0.5, 'a government tenant for 15 years');
      note('Clean lease at the city’s budget rent.');
      return 'Signed: the city rents four floors of ' + name + ' for 15 years at its budget rate. Frank wanted more. He will live.';
    }
    if (choice === 'sweet') {
      lease(SWEET); oneOff(DONATION); remember(lead('hassan', 'mansour'), 0.5, 'the city pays above market');
      note('Sweetheart lease, $0.5M to the campaign.');
      return 'Signed at 20% above market. The company gave ' + money(DONATION) + ' to the Kowalczyk campaign; his fundraiser is booked for the sky lounge.';
    }
    if (choice === 'skim') {
      if (lobby) GameState.board.politicalCapital = Math.max(0, cap() - LOBBY_PC);
      lease(1); oneOff(MARKUP); me().cash = fmt(me().cash + SKIM); m.took = SKIM;
      note('Skim: ' + money(SKIM) + ' in speaking fees.' + (lobby ? ' Lobbied.' : ''));
      return 'Signed at market rent. Kowalczyk Interiors won the fit-out at ' + money(MARKUP) + ' over the next bid. You have been booked for four very well-paid speeches: ' + money(SKIM) + ' to you.';
    }
    m.toKessler = !!rennick();
    remember('petrova', 0.5, 'you turned the mayor down'); remember('okafor', 0.5, 'you turned the mayor down');
    note('Refused.' + (m.toKessler ? ' Frank went to Rennick.' : ''));
    return m.toKessler ? 'You said no. By Friday Frank was touring a Rennick building with Brett Kessler.' : 'You said no. Frank found floors across the river.';
  }

  function investigation(out) {
    const m = M(), c = m.choice; m.invDone = true;
    const head = 'The Ledger, page one: "State opens inquiry into City Hall leases." ';
    if (c === 'clean') {
      say(NORA, 'Reporter, ' + PAPER, 'City Hall leases under investigation', head + 'Our lease is in the file. It is at the city’s budget rate, signed by the book. Nora called for a comment and sounded disappointed.', FACE('journalist'));
      note('Investigation: our clean lease checked out.'); return;
    }
    if (c === 'refuse') {
      GameState.board.politicalCapital = Math.min(GameState.board.maxCapital || 8, cap() + 2); price(1.02);
      if (window.Directors) { if (has('okafor')) Directors.bond('okafor', 1, 'you refused the mayor'); if (has('petrova')) Directors.bond('petrova', 1, 'you refused the mayor'); }
      const R = m.toKessler ? rennick() : null;
      if (R) { R.price = fmt(R.price * 0.88); if (window.War && War.W) { const w = War.W(); w.press = fmt((w.press || 0) + 0.12); } }
      say(NORA, 'Reporter, ' + PAPER, 'The only landlord who said no', head + (R ? 'Rennick Capital rents four floors to the city at a price the inquiry calls "generous". Brett Kessler declined to comment. ' : '') +
          'One landlord turned the mayor down: ' + GameState.company.name + '.<div class="dv-nums">+2 political capital. Share price +2%. Okafor and Petrova think better of you for good.' + (R ? ' Rennick’s shares −12%.' : '') + '</div>', FACE('journalist'));
      if (out) out.push({ good: true, text: 'The Ledger: "the only landlord who said no" to City Hall. Share price +2%' + (R ? '; Rennick −12%.' : '.'), w: 9 });
      note('Investigation: we were the clean ones.' + (R ? ' It landed on Rennick.' : '')); return;
    }
    m.exposed = rnd() < m.odds;
    if (!m.exposed) {
      say(NORA, 'Reporter, ' + PAPER, 'City Hall leases under investigation', head + 'Nora lists every landlord with a city lease. Our name is on the list, near the bottom, with nothing next to it.<div class="dv-nums">Your name never came up.</div>', FACE('journalist'));
      note('Investigation: not found.'); return;
    }
    const others = (GameState.board.directors || []).filter(d => d.id !== 'tex' && d.id !== 'voss');
    if (c === 'sweet') {
      cutRent(); price(0.96);
      others.forEach(d => remember(d.id, d.id === 'petrova' || d.id === 'okafor' ? -2.5 : -1, 'the sweetheart lease with City Hall'));
      if (window.Gary) Gary.S().flagged = true;
      say(NORA, 'Reporter, ' + PAPER, 'Above market, on the taxpayer', head + 'The city pays ' + GameState.company.name + ' 20% over market for four floors, a month after a $0.5M gift to the mayor’s campaign. The council has cut the rent to market.<div class="dv-nums">Share price −4%. Rent back to market. The board remembers, Petrova and Okafor most.</div>', FACE('journalist'));
      if (out) out.push({ good: false, text: 'The Ledger exposes the City Hall lease. Rent cut to market, share price −4%.', w: 10 });
      note('Investigation: the sweetheart lease exposed.'); return;
    }
    // the skim: a court fine from your own money
    const fine = fmt((m.took || SKIM) * FINE_X); payFine(fine); m.fine = fine; price(0.97);
    others.forEach(d => remember(d.id, d.id === 'petrova' ? -3 : -1.5, 'the CEO’s speaking fees'));
    if (window.Gary) Gary.S().flagged = true;
    say(NORA, 'Reporter, ' + PAPER, 'The CEO’s speaking fees', head + 'Kowalczyk Interiors billed ' + money(MARKUP) + ' over the next bid for the city’s floors. The same quarter, the CEO of ' + GameState.company.name + ' was paid ' + money(m.took || SKIM) + ' for four speeches to groups nobody can find.' +
        '<div class="dv-nums">You settle with the state: a fine of ' + money(fine) + ', paid from your own money. You keep your job. Share price −3%. Every director remembers it; Petrova most.</div>', FACE('journalist'));
    if (out) out.push({ good: false, text: 'The Ledger: "The CEO’s speaking fees". You pay a ' + money(fine) + ' fine from your own money.', w: 10 });
    note('Investigation: the skim exposed, fine ' + money(fine) + '.');
  }
  /* From your cash first, then by selling your shares. */
  function payFine(f) {
    const c = me(), px = GameState.company.sharePrice || 1;
    const fromCash = Math.min(Math.max(0, c.cash), f); c.cash = fmt(c.cash - fromCash);
    let left = fmt(f - fromCash);
    if (left > 0 && c.shares > 0) { const n = Math.min(c.shares, Math.ceil(left * 1e6 / px)); c.shares -= n; left = fmt(left - n * px / 1e6); }
    if (left > 0) c.cash = fmt(c.cash - left);
  }

  // ============================================================================
  // THE CARD
  // ============================================================================
  const CARD = { id: 'mayor_offer', system: true, story: true, holdQ: 2,
    build() {
      const m = M(); if (m.stage !== 'offer') return null;
      const p = (GameState.portfolio || []).find(x => x.id === m.bld); if (!p) { m.stage = 'none'; return null; }
      const isTower = p.id === TOWER, pre = isTower && window.Tower && Tower.T().stage === 'build';
      const full = isTower && pre ? (Tower.plan ? Tower.plan(Tower.T().size).rentFull : 15) : p.annualNOI;
      const rentY = fmt(full * SHARE), friend = port().mayor, schemed = port().route === 'mayor';
      const o = odds(false), oL = odds(true);
      const where = pre ? 'Celestial Heights, before it opens' : p.name;
      return { title: 'The mayor needs four floors', from: FRANK.name, face: FRANK.face,
        body: '"' + (friend || schemed ? 'Old friend. ' : '') + 'City Hall’s lease is up and the building is falling down. I need four floors for planning and permits, and I want them in ' + where + '. Fifteen years, the city always pays. Now, how we write it up is between friends."' +
              nums([['The city would take', 'about ' + Math.round(SHARE * 100) + '% of ' + (isTower ? 'the tower' : p.name)],
                    ['Market rent for those floors', 'about ' + money(rentY) + ' a year'],
                    ['Clean (budget rate)', money(rentY * CLEAN) + ' a year, 15 years, no risk'],
                    ['Sweetheart (+20%)', money(rentY * SWEET) + ' a year, $0.5M to his campaign; found ' + tenths(o) + ': rent cut, price −4%'],
                    ['His cousin’s fit-out', 'market rent; the company overpays ' + money(MARKUP) + ', ' + money(SKIM) + ' comes to you; found ' + tenths(o) + ' (' + tenths(oL) + ' if you lobby): you pay a ' + money(SKIM * FINE_X) + ' fine'],
                    ['Your own money', money(me().cash)]]) +
              (schemed ? '<div class="dv-nums">Nora already has a file on you and Frank from the Port Logistics business: the odds of being found are higher.</div>' : '') +
              '<div class="dv-nums">Jenkins: "The budget rate is clean. Refusing is clean. The other two are what investigations are made of."</div>' +
              voice(lead('okafor', 'petrova'), '"A government tenant is the best tenant there is. A government favour is the worst."'),
        choices: [
          { label: 'Clean lease at the city’s budget rent (15% under market)', detail: (isTower ? 'The tower opens fuller and can become a trophy. Williams +1. ' : '') + 'Okafor +0.5. Nothing to find later.',
            apply() { return decide('clean'); } },
          { label: 'Sweetheart lease: 20% over market, $0.5M to his campaign', detail: 'More rent for 15 years. If the inquiry finds it (' + tenths(o) + '): the council cuts the rent to market, price −4%, the board remembers.',
            apply() { return decide('sweet'); } },
          { label: 'Give the fit-out to his cousin: ' + money(SKIM) + ' to you', detail: 'Market rent. The company overpays ' + money(MARKUP) + ' this quarter. Found ' + tenths(o) + ': a ' + money(SKIM * FINE_X) + ' fine from your own money, price −3%. You keep your job.',
            apply() { return decide('skim', false); } },
          { label: 'The fit-out, and lobby to keep it quiet (' + LOBBY_PC + ' political capital)', detail: 'Same deal, found only ' + tenths(oL) + '. You have ' + cap() + '.',
            check: () => cap() >= LOBBY_PC, checkMsg: 'Needs ' + LOBBY_PC + ' political capital',
            apply() { return decide('skim', true); } },
          { label: 'Refuse', detail: 'The floors stay empty for now. Okafor and Petrova +0.5. ' + (rennick() ? 'Frank will take his floors to Kessler.' : 'Frank will go elsewhere.'),
            apply() { return decide('refuse'); } },
        ] };
    } };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === CARD.id)) World.DECISIONS.push(CARD);

  /* The ending card (ending.js). */
  function ending() {
    const m = M();
    if (m.stage !== 'done') return null;
    if (m.choice === 'clean') return 'clean';
    if (m.choice === 'refuse') return m.toKessler ? 'refused_kessler' : 'refused';
    if (!m.invDone) return m.choice + '_pending';
    return m.choice + (m.exposed ? '_exposed' : '_quiet');
  }
  function debug(o) { Object.assign(M(), o || {}); return M(); }

  return { M, processQuarter, decide, investigation, ending, target, odds, payFine, debug, SHARE, SKIM, FINE_X };
})();
