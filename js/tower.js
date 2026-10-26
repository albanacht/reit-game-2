/* ============================================================================
   tower.js — STORY 4: CELESTIAL HEIGHTS (round 14; STORY_TOWER_DRAFT.md v1).

   Act 1  Year 8 meeting: Williams brings his nephew Sebastian Hale in as
          Chief Vision Officer.
   Act 2  Year 9 meeting: Sebastian presents the tower; the board gives you
          the task (full, smaller, or refuse).
   Act 3  The Fifth Street lot (inbox card), then the money (inbox card):
          construction loan, preferred shares, new shares, or a partner.
   Act 4  Ten quarters of construction: an overrun card, Calder & Rowe's
          pre-letting offer at the meeting, Sebastian's notes.
   Act 5  Completion: about 3 in 10 a pandemic hits (road A, a half empty
          tower), else it is merely fine (road B). The meeting picks the path.
   Act 6  Williams retires with honour, or falls; the board elects a new
          chair whose red line replaces Williams's dividend rule.

   Numbers scale with the company (f): the tower is about a third of your
   assets whatever size you are. Everything about the tower lives in
   GameState.story.tower; the building itself is a normal portfolio entry
   (id off_cel) that the story drives while it is being built and let.
   ========================================================================== */

window.Tower = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + 'M';
  const pc = n => Math.round(n * 100) + '%';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const SEB = { name: 'Sebastian Hale', face: FACE('sebastian'), role: 'Chief Vision Officer, Williams’s nephew' };
  const SEBN = 'Sebastian Hale', SEBR = 'Chief Vision Officer';
  const ID = 'off_cel', LOT = 'lot_01', NAME = 'Celestial Heights';
  const NORA = 'Nora Whitlock', PAPER = 'Riverton Ledger';

  function T() {
    const s = Story.S();
    if (!s.tower) s.tower = { stage: 'wait', log: [] };
    return s.tower;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const spendPC = n => { GameState.board.politicalCapital = Math.max(0, cap() - n); };
  const cash = d => { GameState.balance.cash = fmt(GameState.balance.cash + d); };
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const voice = (id, text) => !has(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + Directors.name(id).replace(/^(Chairman|Chair|Director) /, '') + ':</b> ' + text + '</div></div>';
  const note = t => T().log.push({ q: tq(), t });
  const tower = () => (GameState.portfolio || []).find(p => p.id === ID) || null;
  const lot = () => (GameState.devLots || []).find(l => l.id === LOT) || null;
  const warOn = () => window.War && ['war', 'crisis'].indexOf(War.W().stage) > -1 && GameState.rivals && GameState.rivals.ren && !GameState.rivals.ren.gone;
  const surcharge = d => { GameState._gaSurcharge = fmt(Math.max(0, (GameState._gaSurcharge || 0) + d)); };

  /* The tower's numbers, scaled to the company when the task is given. */
  function plan(size) {
    const t = T(), f = t.f || 1, small = size === 'small';
    return { plot: fmt(28 * f), build: fmt((small ? 90 : 160) * f), rentFull: fmt((small ? 0.63 : 1) * 15.2 * f),
             floors: small ? 34 : 58, get total() { return fmt(this.plot + this.build); } };
  }
  const shareOf = () => T().jv ? 1 - T().jv : 1;               // our share with a partner
  /* NOI at an occupancy, the way financials.js counts it (operating costs are 30% of full rent, let or not). */
  const noiAt = (full, o) => fmt(full * Math.max(0, o - 0.30) / 0.70);

  // ============================================================================
  // THE MEETING (Story.agenda calls this, after Harlow and the war)
  // ============================================================================
  function agenda(year, items) {
    const t = T(); items = items || [];
    if (!has('williams') && t.stage === 'wait') return items;              // no Williams, no nephew
    // Act 1: the nephew
    if (t.stage === 'wait' && year >= 8) {
      t.stage = 'nephew'; t.nephewYear = year;
      items.push({ guest: SEB, lines: [
        ['williams', 'Before the vote, a personal item. My nephew Sebastian is back from Monaco. Ten years building luxury brands. I would like him to bring that thinking here, as Chief Vision Officer.'],
        ['guest', 'Thrilled to be here. Real estate is the last industry without a story. I intend to give it one.'],
        [lead('petrova', 'okafor'), 'With respect, Chairman, we are a listed company, not a family office.']],
        choices: [
          { label: 'Welcome him', primary: true, detail: 'Sebastian joins at $0.8M a year (overheads). Williams +1.5. Petrova −0.5.',
            go: () => { t.seb = 'full'; surcharge(0.2); remember('williams', 1.5, 'you welcomed Sebastian'); remember('petrova', -0.5, 'the chairman’s nephew on the payroll'); note('Sebastian joined as Chief Vision Officer.'); return 'Sebastian shook every hand in the room. Twice.'; } },
          { label: 'A smaller role: Head of Brand', detail: '$0.4M a year. Williams −0.5. Sebastian comes anyway, slightly offended.',
            go: () => { t.seb = 'brand'; surcharge(0.1); remember('williams', -0.5, 'you gave Sebastian a smaller job'); note('Sebastian joined as Head of Brand.'); return '"Head of Brand. Fine. Brands are where it starts."'; } },
          { label: 'Say no', detail: 'Williams −2.5 and remembers. Sebastian comes anyway, as a "consultant" Williams pays himself. The tower still comes next year.',
            go: () => { t.seb = 'consultant'; remember('williams', -2.5, 'you refused his nephew'); note('Sebastian stayed on as Williams’s consultant.'); return 'Williams said nothing for the rest of the meeting.'; } },
        ] });
      return items;
    }
    // Act 2: the task
    if (t.stage === 'nephew' && year > t.nephewYear && year >= 9) {
      t.stage = 'task';
      const G = GameState; t.f = clamp(Math.round((G.balance.totalAssets || 300) * 0.33 / 188 * 20) / 20, 0.6, 1.6);
      const P = plan('full'), S = plan('small');
      const value = fmt(noiAt(P.rentFull, 0.92) / 0.0525);
      items.push({ guest: SEB, lines: [
        ['guest', 'Celestial Heights. ' + P.floors + ' floors on the Fifth Street lot. Offices below, twelve floors of apartments on top, and a sky lounge. Riverton’s new skyline.'],
        ['williams', 'I have waited thirty years for this city to have a building worth looking up at. I would like to see it before I retire.'],
        [lead('chen', 'williams'), 'Trophy towers sell at a 5.25% yield. If it lets, we make money the day it opens.'],
        [lead('okafor', 'petrova'), 'A third of our assets in one building that earns nothing for three years. If anything goes wrong while it is half empty, it takes the company with it.']],
        note: 'The plot ' + money(P.plot) + ' + construction ' + money(P.build) + ' over 10 quarters = ' + money(P.total) + '. Rent after costs when 92% let: ' + money(noiAt(P.rentFull, 0.92)) + ' a year (' + (noiAt(P.rentFull, 0.92) / P.total * 100).toFixed(1) + '% on cost). Worth about ' + money(value) + ' at a trophy yield: about ' + money(value - P.total) + ' more than it costs.',
        choices: [
          { label: 'Build it (Williams and Chen)', primary: true, detail: money(P.total) + ', ' + P.floors + ' floors. Becomes the board’s task. Williams +2, Chen +1, Okafor −1.5.',
            go: () => { t.size = 'full'; t.stage = 'plot'; t.plotQ = tq() + 1; remember('williams', 2, 'you backed Celestial Heights'); remember('chen', 1, 'you backed the tower'); remember('okafor', -1.5, 'the tower'); t.okaforOpposed = true; note('The board set the task: build Celestial Heights.'); return 'Sebastian hugged Williams. Okafor wrote something in his notebook.'; } },
          { label: 'Build it smaller: ' + S.floors + ' floors', detail: money(S.total) + '. Same yield on cost, less upside, less risk. Williams −1 ("my nephew’s vision, cut in half"), Okafor +0.5.',
            go: () => { t.size = 'small'; t.stage = 'plot'; t.plotQ = tq() + 1; remember('williams', -1, 'you cut the tower in half'); remember('okafor', 0.5, 'a smaller tower'); t.okaforOpposed = true; note('The board set the task: a smaller Celestial Heights.'); return '"Thirty-four floors," said Sebastian. "Intimate."'; } },
          { label: 'Refuse (Okafor)', detail: 'No tower. Williams −3 and votes against you next year. Chen −1. The lot stays a car park.',
            go: () => { t.stage = 'refused'; t.ending = 'never'; t.williamsAgainst = year + 1; remember('williams', -3, 'you refused his tower'); remember('chen', -1, 'you refused the tower'); remember('okafor', 1, 'you refused the tower'); note('You refused the tower.'); return 'Williams closed his folder. "Noted."'; } },
        ] });
    }
    // Act 4: Calder & Rowe want to pre-let, argued while it is built
    if (t.stage === 'build' && t.calder == null && t.qLeft <= 7) {
      const P = plan(t.size);
      items.push({ lines: [
        [lead('okafor', 'petrova'), 'Calder & Rowe, the investment bank, will take twelve floors at 20% under asking rent. A fifth of the tower let before it opens. Take it.'],
        [lead('chen', 'williams'), 'And give away a fifth of the rent for ten years? The market is strong. Hold out for full rent.']],
        choices: [
          { label: 'Sign Calder & Rowe (Okafor)', primary: true, detail: 'The tower opens at least 15 points fuller, with rent about 4% lower overall. Okafor +1, Chen −0.5.',
            go: () => { t.calder = true; remember('okafor', 1, 'you pre-let the tower'); remember('chen', -0.5, 'rent given away'); note('Calder & Rowe signed for twelve floors.'); return 'Signed: twelve floors, ten years.'; } },
          { label: 'Hold out for full rent (Chen and Sebastian)', detail: 'More rent if the market holds, an emptier tower if it does not. Chen +1, Okafor −0.5.',
            go: () => { t.calder = false; remember('chen', 1, 'you held out for full rent'); remember('okafor', -0.5, 'an unlet tower'); return 'Sebastian is "reimagining the leasing journey".'; } },
        ] });
    }
    // Act 5: the path, at the first meeting after completion
    if (t.stage === 'open' && !t.path) items.push(pathItem());
    // Act 6: the chair
    if (has('williams') && !t.chairDone) {
      const fallen = (t.road === 'A' && !!t.openQ) || (window.Directors && Directors.rep('williams') < 30 && ['open', 'held', 'sold', 'jv', 'convert', 'trophy'].indexOf(t.stage) > -1);
      if (fallen && !t.saved) items.push(fallItem(items));
      else if (year >= 14 || (t.saved && year > t.savedYear)) items.push(retireItem(items));
    }
    return items;
  }

  function pathItem() {
    const t = T(), p = tower(), A = t.road === 'A', C = fmt(t.cost);
    const choices = [
      { label: A ? 'Hold and wait' : 'Hold and lease it up (Williams and Chen)', primary: true,
        detail: A ? 'It creeps back toward 70% let over 3 to 4 years, if the pandemic passes. Williams +0.5.' : 'About 6 in 10 it reaches 90% let within 3 years, and then it is a trophy (worth about ' + money(noiAt(p.annualNOI, 0.92) / 0.0525) + '). Otherwise it drifts. Williams +1, Chen +1.',
        go: () => { t.path = 'hold'; t.stage = 'held'; t.success = !A && rnd() < 0.6; remember('williams', A ? 0.5 : 1, 'you kept the tower'); if (!A) remember('chen', 1, 'you kept the tower'); return 'We keep it. Sebastian ordered new banners.'; } },
    ];
    if (!t.jv) choices.push({ label: 'Sell 49% to Fjordhavn at cost (Okafor)', detail: 'Fjordhavn, the Norwegian pension fund, pays ' + money(C * 0.49) + ' for 49%. No loss locked in; half the upside gone. Williams −1, Okafor +1.',
      go: () => { t.path = 'jv'; t.stage = 'held'; t.success = !A && rnd() < 0.6; t.jv = 0.49; cash(fmt(C * 0.49)); p.annualNOI = fmt(p.annualNOI * 0.51); p.currentValue = fmt(p.currentValue * 0.51); p.baseValue = p.currentValue; p.vb = null; t.cost = fmt(C * 0.51);
        remember('williams', -1, 'half his tower sold'); remember('okafor', 1, 'you shared the risk'); note('Sold 49% to Fjordhavn.'); return 'Fjordhavn wired ' + money(C * 0.49) + '. They asked to rename the sky lounge. We said no.'; } });
    choices.push({ label: 'Sell the whole tower: about ' + money(p.currentValue), detail: 'Take the ' + money(Math.max(0, C - p.currentValue)) + ' loss against cost and end it. Williams −3 (his legacy, sold). Okafor +1.',
      go: () => { t.path = 'sold'; t.stage = 'sold'; t.ending = 'sold'; const v = p.currentValue; Properties.sellProperty(ID, v); remember('williams', -3, 'you sold his tower'); remember('okafor', 1, 'you cut the losses'); note('Sold the tower.'); return 'Sold for ' + money(v) + '. Sebastian cried in the lift.'; } });
    if (A) choices.push({ label: 'Convert the office floors to apartments: ' + money(30 * (t.f || 1) * shareOf()), detail: '6 quarters closed, then about 75% let as apartments. Williams −1 ("my tower, a block of flats"). Hassan or Salma +1.',
      disabled: (window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash) < 30 * (t.f || 1) * shareOf(), why: 'Not enough cash plus credit line',
      go: () => { t.path = 'convert'; t.stage = 'convert'; const c = fmt(30 * (t.f || 1) * shareOf()); cash(-c); t.cost = fmt(t.cost + c); p.underConstruction = true; p.constructionType = 'tower_conv'; p.constructionQuartersLeft = 999; p.occupancy = 0; t.convQ = 6;
        remember('williams', -1, 'his tower, a block of flats'); remember(lead('hassan', 'mansour'), 1, 'apartments that will let'); note('Converting to apartments.'); return 'The office floors are coming out. ' + money(c) + ' committed.'; } });
    return { lines: A ? [[lead('okafor', 'petrova'), 'I said this in this room in Year 9. It is in the minutes.'], ['williams', 'The pandemic is not a planning error.'], [lead('chen', 'petrova'), 'What we do now is the only question.']]
                      : [[lead('chen', 'williams'), 'Seventy percent let in year one is not a failure. Give it time.'], [lead('okafor', 'petrova'), 'It cost ' + money(C) + ' and is worth ' + money(p.currentValue) + '. Sell half while someone will pay cost.']],
             note: NAME + ': ' + pc(p.occupancy) + ' let, rent after costs about ' + money(noiAt(p.annualNOI, p.occupancy)) + ' a year, worth ' + money(p.currentValue) + ' against ' + money(C) + ' of cost.', choices };
  }

  function fallItem(items) {
    const t = T(), mover = lead('petrova', 'okafor');
    return { lines: [[mover, 'Chairman, I am sorry to do this in the room. The tower has cost this company ' + money(Math.max(0, t.cost - (tower() ? tower().currentValue : 0))) + ' and the shareholders want someone to answer for it. I move that the chairman step down.'],
                     ['williams', 'Thirty years. And this is how it ends.']],
      choices: [
        { label: 'Save him (3 political capital)', detail: 'He stays one more year, weakened, then retires. Williams +2 and an ally. ' + (has('petrova') ? 'Petrova' : 'The mover') + ' −1.5. You have ' + cap() + '.',
          disabled: cap() < 3, why: 'Needs 3 political capital',
          go: () => { spendPC(3); t.saved = true; t.savedYear = GameState.meta.year; if (window.Directors) { Directors.bond('williams', 2, 'you saved him'); Directors.repChange('williams', 35 - Directors.rep('williams'), 'you saved his seat'); } remember('williams', 2, 'you saved him'); remember(mover, -1.5, 'you protected the chairman'); return 'The motion was withdrawn. Williams did not look at you, but he nodded.'; } },
        { label: 'Let him fall', primary: true, detail: 'Williams and Sebastian leave today. The board elects a new chair.',
          go: () => { leave('fell'); items.push(successionItem()); return 'Williams gathered his papers. Sebastian was already gone.'; } },
      ] };
  }
  function retireItem(items) {
    const t = T(), proud = t.stage === 'trophy' || (t.stage === 'held' && t.road === 'B');
    return { lines: [['williams', proud ? 'Thirty years on this board. I can see ' + NAME + ' from my kitchen window. Time for someone younger in this chair.' : 'Thirty years on this board. It is time for someone else to sit in this chair.']],
      effect: () => { leave(proud ? 'honour' : 'retired'); items.push(successionItem()); return 'Williams retires' + (proud ? ' with honour. His name goes on the lobby wall of ' + NAME + '.' : '.') + (t.seb && t.seb !== 'gone' ? ' Sebastian leaves for "a project in Dubai".' : ''); } };
  }
  function leave(how) {
    const t = T();
    t.williamsGone = how; t.chairDone = true;
    if (t.seb === 'full') surcharge(-0.2); else if (t.seb === 'brand') surcharge(-0.1);
    if (t.seb) t.seb = 'gone';
    if (window.Directors) Directors.removeDirector('williams', how === 'fell' ? 'Chairman Williams stepped down after ' + NAME + '.' : 'Chairman Williams retired.');
    note(how === 'fell' ? 'Williams fell.' : 'Williams retired.');
  }

  /* The succession: Okafor, Petrova, Chen, or you as executive chairman. */
  function successionItem() {
    const t = T(), G = GameState, ds = G.board.directors || [];
    const avg = ds.reduce((a, d) => a + d.attitude, 0) / Math.max(1, ds.length);
    const cands = ['okafor', 'petrova', 'chen'].filter(has);
    const odds = id => {
      const d = ds.find(x => x.id === id); let p = 0.35 + 0.08 * ((d ? d.attitude : 5) - 5);
      if (id === 'okafor' && t.okaforOpposed && (t.road === 'A' || t.ending === 'never')) p += 0.25;
      if (id === 'chen' && t.road === 'A') p -= 0.2;
      if (id === 'petrova') p += 0.1;
      return clamp(p, 0.1, 0.9);
    };
    const fav = () => cands.slice().sort((a, b) => odds(b) - odds(a))[0];
    const meOdds = clamp(0.2 + 0.08 * (avg - 5) + (has('tex') ? 0.15 : 0), 0.05, 0.75);
    const install = (id, why) => {
      G.board.chair = id; t.chair = id;
      if (window.Directors) { Directors.logBoard(Directors.name(id) + ' became chair' + (why ? ' (' + why + ')' : '') + '.'); }
      note('New chair: ' + id + '.');
    };
    const red = id => Directors.CHAIR_RED[id] ? Directors.CHAIR_RED[id].text : 'none';
    const choices = cands.map(id => ({ label: 'Back ' + Directors.name(id).replace(/^(Director|Chair) /, ''), primary: id === fav(),
      detail: 'Their red line as chair: ' + red(id) + '. About ' + Math.round(odds(id) * 10) + ' in 10 the board agrees with you; otherwise ' + Directors.name(fav() === id ? cands.filter(x => x !== id).sort((a, b) => odds(b) - odds(a))[0] || id : fav()).replace(/^(Director|Chair) /, '') + ' gets it. Your choice +1 with them.',
      go: () => { remember(id, 1, 'you backed them for chair'); const won = rnd() < odds(id), w = won ? id : (fav() === id ? (cands.filter(x => x !== id).sort((a, b) => odds(b) - odds(a))[0] || id) : fav()); install(w, won ? 'with your backing' : 'the board chose');
        return Directors.name(w) + ' takes the chair. Their red line: ' + red(w) + '.'; } }));
    choices.push({ label: 'Put yourself forward: executive chairman (4 political capital)', detail: 'You chair the board that judges you: no chair’s red line, ties go your way. About ' + Math.round(meOdds * 10) + ' in 10 the board agrees. Nora calls it a power grab: share price −2%. Petrova −2 for good. You have ' + cap() + '.',
      disabled: cap() < 4, why: 'Needs 4 political capital',
      go: () => { spendPC(4); G.company.sharePrice = fmt(G.company.sharePrice * 0.98); remember('petrova', -2, 'the CEO made himself chairman');
        if (rnd() < meOdds) { G.board.chair = 'you'; t.chair = 'you'; if (window.Directors) Directors.logBoard('The CEO became executive chairman.'); note('You became executive chairman.'); return 'You are now chairman and CEO. The governance people have already written to the newspaper.'; }
        const w = fav(); install(w, 'the board turned you down'); remember(w, -1, 'you tried to take the chair'); return 'The board said no. ' + Directors.name(w) + ' takes the chair, and remembers that you wanted it.'; } });
    return { lines: [[lead('petrova', cands[0] || 'chen'), 'The board must elect a chair. There are three of us who could do it, and one CEO who might want to.']], choices };
  }

  // ============================================================================
  // BETWEEN MEETINGS
  // ============================================================================
  function processQuarter(out) {
    const t = T(), s = Story.S(), G = GameState, now = tq();
    if (G.meta.gameOver) return;
    if (t.williamsAgainst && G.meta.year > t.williamsAgainst) t.williamsAgainst = null;
    seb(out);
    if (t.stage === 'plot' && now >= t.plotQ && !s.due) { s.due = 'tower_plot'; return; }
    if (t.stage === 'finance' && !s.due) { s.due = 'tower_finance'; return; }
    if (t.stage === 'build') build(out);
    if (t.stage === 'convert') convert(out);
    if (t.stage === 'held') leaseUp(out);
  }

  /* Sebastian, between meetings: one note a year or so, small money. */
  const SEB_NOTES = [
    ['A signature scent for every lobby', 'I have commissioned a signature scent for all our lobbies: cedar, rain, "a hint of ambition". $0.2M. Tenants will feel it before they see it.', 0.2],
    ['Our new logo', 'Our logo is now two interlocking C’s. Celestial, Capital. Also Courage. The agency was $0.15M. Worth every cent.', 0.15],
    ['Leadership retreat, Lake Como', 'I have booked the leadership team into a villa on Lake Como for three days of "vertical thinking". $0.3M. You are all invited. Okafor has declined.', 0.3],
    ['The sky lounge playlist', 'I have hired a DJ to compose a playlist for the sky lounge, which does not exist yet. $0.1M. You will thank me in two years.', 0.1],
  ];
  function seb(out) {
    const t = T();
    if (!t.seb || t.seb === 'gone' || t.seb === 'consultant' || t.stage === 'refused') return;
    t.sebNext = t.sebNext || tq() + rint(2, 4);
    if (tq() < t.sebNext) return;
    t.sebNext = tq() + rint(3, 5); t.sebI = (t.sebI || 0);
    const n = SEB_NOTES[t.sebI % SEB_NOTES.length]; t.sebI++;
    oneOff(n[2]); say(SEBN, SEBR, n[0], n[1] + '<div class="dv-nums">One-off cost $' + n[2].toFixed(2) + 'M.</div>', SEB.face);
  }

  // -- Act 3: buy the lot -------------------------------------------------------
  function buyLot(price) {
    const t = T(), L = lot(), M = { id: ID, n: NAME, t: 'office', ti: 'tier1', z: 'cbd', o: 'you', x: L ? L.x : 78.8, y: L ? L.y : 53.2, v: price, cap: 5.25, occ: 0, ph: 'supertower', noi: 0.01,
      story: 'Williams’s tower, Sebastian’s vision. ' + plan(t.size).floors + ' floors on the Fifth Street lot.' };
    const p = Properties.fromMaster(M, true);
    Object.assign(p, { purchasePrice: price, currentValue: price, baseValue: price, underConstruction: true, constructionType: 'tower', constructionQuartersLeft: 999,
                       occupancy: 0, annualNOI: 0, storyLock: true, askingPrice: null, quarterOwned: 0, capexReserve: 0, vb: null });
    GameState.portfolio.push(p);
    GameState.devLots = (GameState.devLots || []).filter(l => l.id !== LOT);
    cash(-price); t.cost = price; t.plotPaid = price; t.stage = 'finance';
    note('Bought the Fifth Street lot for ' + money(price) + '.');
  }

  // -- Act 3: the money -----------------------------------------------------------
  function finance(kind) {
    const t = T(), P = plan(t.size), G = GameState, f = t.f || 1;
    t.fin = kind; t.build = P.build; t.qLeft = 10; t.qTotal = 10; t.extra = 0; t.stage = 'build'; t.buildQ0 = tq();
    if (kind === 'loan') {
      t.loanMax = fmt(P.build * 0.625);
      G.debtTranches.push({ id: 'tower_loan', amount: 0, rate: fmt((G.market.baseInterestRate || 3) + 3), maturityQuarter: G.meta.quarter, maturityYear: G.meta.year + 25,
                            quartersUntilMaturity: 100, label: NAME + ' construction loan (floating)', unsecured: false });
      return 'The bank will lend up to ' + money(t.loanMax) + ', drawn as we build, at the base rate +3%.';
    }
    if (kind === 'pref') {
      const amt = Math.min(fmt(90 * f), Financials.prefRoom()), r = Financials.issuePreferredFor(amt, NAME);
      t.prefAmt = amt;
      return r.message;
    }
    if (kind === 'equity') {
      const want = fmt(80 * f), n = fmt(Math.min(G.company.sharesOutstanding * 0.2, want / G.company.sharePrice));
      const r = Financials.issueEquity(n);
      return r.message;
    }
    if (kind === 'jv') {
      t.jv = 0.49; cash(fmt(t.plotPaid * 0.49)); t.cost = fmt(t.plotPaid * 0.51);
      const p = tower(); if (p) { p.currentValue = fmt(p.currentValue * 0.51); p.baseValue = p.currentValue; p.purchasePrice = p.currentValue; }
      remember('williams', -1, 'half his tower belongs to Norwegians'); remember('okafor', 1, 'a partner shares the risk');
      return 'Fjordhavn owns 49% and pays 49% of every bill. They repaid 49% of the lot: ' + money(t.plotPaid * 0.49) + '.';
    }
    return '';
  }

  // -- Act 4: construction --------------------------------------------------------
  function build(out) {
    const t = T(), p = tower(), G = GameState;
    if (!p) { t.stage = 'sold'; return; }
    if (t.paused > 0) { t.paused--; out.push({ text: NAME + ': works paused (' + t.paused + ' more quarter' + (t.paused === 1 ? '' : 's') + ').' }); return; }
    const draw = fmt((t.build / t.qTotal + (t.extra || 0) / Math.max(1, t.qLeft)) * shareOf());
    if (t.extra) t.extra = fmt(t.extra - t.extra / Math.max(1, t.qLeft));
    let fromLoan = 0;
    if (t.fin === 'loan') {
      const tr = G.debtTranches.find(x => x.id === 'tower_loan');
      if (tr) { fromLoan = fmt(Math.min(draw * 0.625, Math.max(0, t.loanMax - tr.amount))); tr.amount = fmt(tr.amount + fromLoan); tr.rate = fmt((G.market.baseInterestRate || 3) + 3); }
    }
    cash(-(draw - fromLoan));
    p.currentValue = fmt(p.currentValue + draw); p.baseValue = p.currentValue; p.purchasePrice = p.currentValue; t.cost = fmt(t.cost + draw);
    t.qLeft--;
    if (t.qLeft === 5 && !t.overrunDone && !Story.S().due) { t.overrunDone = true; Story.S().due = 'tower_overrun'; }
    if (t.qLeft <= 0) complete(out);
  }

  // -- Act 5: completion ------------------------------------------------------------
  function complete(out) {
    const t = T(), p = tower(), G = GameState, P = plan(t.size), ph = window.Arc && Arc.phase ? Arc.phase() : '';
    const odds = (ph === 'crisis' || ph === 'aftershock') ? 0.45 : 0.30;
    t.road = t.forceRoad || (rnd() < odds ? 'A' : 'B');
    const A = t.road === 'A';
    if (A) {                                           // the city's pandemic, then the tower's own hit
      const ev = window.Events && Events.EVENT_CATALOGUE && Events.EVENT_CATALOGUE.find(e => e.id === 'pandemic_shock');
      if (ev) { try { const r = ev.apply(); if (r) out.push({ good: false, text: r.headline + ': ' + r.impact, w: 10 }); } catch (e) {} }
    }
    const occ = A ? (t.calder ? 0.55 : 0.40) : (t.calder ? 0.80 : 0.70);
    const rentFull = fmt(P.rentFull * (t.calder ? 0.96 : 1) * shareOf());
    const value = fmt(rentFull * occ / (A ? 0.07 : 0.0625) * (t.loungeCut ? 0.96 : 1));
    Object.assign(p, { underConstruction: false, constructionType: null, constructionQuartersLeft: 0, occupancy: occ, annualNOI: rentFull, vb: null, quarterOwned: 0 });
    t.impair = fmt(Math.max(0, p.currentValue - value)); t.impairQ = tq();
    if (window.IndexFund) IndexFund.writeDown(t.impair);
    p.currentValue = value; p.baseValue = value;
    // the construction loan becomes bonds, at whatever rates are now
    if (t.fin === 'loan') {
      const tr = G.debtTranches.find(x => x.id === 'tower_loan');
      if (tr) { tr.rate = fmt(Market.getCurrentBorrowingRate() + (A ? 1.5 : 0.5)); tr.quartersUntilMaturity = 20; tr.maturityYear = G.meta.year + 5; tr.label = NAME + ' bonds (refinanced, ' + tr.rate + '%)'; tr.id = 'tower_bonds'; }
    }
    if (A && window.Directors) Directors.repChange('williams', -30, 'the empty tower');
    t.stage = 'open'; t.openQ = tq();
    Story.S().due = Story.S().due || 'tower_open';
    note('Completed. Road ' + t.road + '.');
  }

  /* Act 5 aftermath: occupancy follows the path chosen at the meeting. */
  function leaseUp(out) {
    const t = T(), p = tower();
    if (!p) { t.stage = 'sold'; return; }
    const A = t.road === 'A', top = A ? 0.70 : t.success ? 0.93 : 0.78, step = A ? 0.015 : t.success ? 0.025 : 0.01;
    if (p.occupancy < top) p.occupancy = Math.min(top, fmt(p.occupancy + step));
    if (!A && t.success && p.occupancy >= 0.90 && !t.trophy) {
      t.trophy = true; t.stage = 'trophy'; t.ending = 'trophy'; p.storyLock = false;
      p.currentValue = fmt(noiAt(p.annualNOI, p.occupancy) / 0.0525); p.baseValue = p.currentValue; p.vb = null;
      remember('williams', 1.5, 'the tower is full'); remember('chen', 1, 'the tower is a trophy');
      out.push({ good: true, text: NAME + ' is ' + pc(p.occupancy) + ' let: a trophy tower, now valued at ' + money(p.currentValue) + '.', w: 10 });
      say(NORA, 'Reporter, ' + PAPER, NAME + ' is full', 'The Ledger: "Riverton’s skyline finally has a landmark people want to work in." ' + NAME + ' is ' + pc(p.occupancy) + ' let and valued at ' + money(p.currentValue) + '.', FACE('journalist'));
    }
  }
  function convert(out) {
    const t = T(), p = tower();
    if (!p) { t.stage = 'sold'; return; }
    t.convQ--;
    if (t.convQ > 0) return;
    const f = t.f || 1;
    Object.assign(p, { underConstruction: false, constructionType: null, sector: 'multifamily', label: 'Apartments', occupancy: 0.75, annualNOI: fmt(10.5 * f * (t.size === 'small' ? 0.63 : 1) * shareOf()), vb: null, storyLock: false });
    p.currentValue = fmt(noiAt(p.annualNOI, 0.75) / 0.055); p.baseValue = p.currentValue;
    t.stage = 'converted'; t.ending = 'apartments';
    out.push({ good: true, text: NAME + ' reopens as apartments: 75% let, valued at ' + money(p.currentValue) + '.', w: 8 });
  }

  // ============================================================================
  // THE CARDS
  // ============================================================================
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const CARDS = [
    { id: 'tower_plot', system: true, story: true,
      build() {
        const t = T(); if (t.stage !== 'plot') return null;
        const P = plan(t.size), war = warOn(), price = fmt(P.plot * (war ? 1.1 : 1));
        return { title: 'The Fifth Street lot goes to auction', from: SEBN + ', ' + SEBR, face: SEB.face,
          body: '"The city is auctioning the Fifth Street lot next week. This is where Celestial Heights stands. I have already ordered the groundbreaking shovel (gold)."' +
                nums([['Price', money(P.plot) + (war ? ' (Kessler is bidding too: ' + money(price) + ' to beat him)' : '')], ['Then', 'construction ' + money(P.build) + ' over 10 quarters'], ['Your cash plus credit line', money(spendable())]]) +
                voice('okafor', '"Once we own the dirt, there is no going back."'),
          choices: [
            { label: 'Buy it: ' + money(price), check: () => spendable() >= price, checkMsg: 'Not enough cash plus credit line',
              apply() { buyLot(price); return 'The Fifth Street lot is ours. Sebastian posed with the gold shovel.'; } },
            ...(war ? [{ label: 'Make the land office "lose" Kessler’s bid: ' + money(P.plot) + ' (1 political capital)', detail: 'Tex or Chen makes a call.', costType: 'capital', cost: 1, check: () => spendable() >= P.plot && cap() >= 1, checkMsg: 'Needs 1 political capital and the cash',
              apply() { spendPC(1); buyLot(P.plot); if (window.War) War.W().log.push({ q: tq(), t: 'Beat Kessler to the Fifth Street lot.' }); return 'Kessler’s bid arrived "after the deadline". The lot is ours.'; } }] : []),
            { label: 'Not this quarter', detail: 'The lot waits for the next auction. Williams −0.5.',
              apply() { t.plotQ = tq() + 1; remember('williams', -0.5, 'you delayed his tower'); return 'Postponed. Williams asked twice why.'; } },
          ] };
      } },
    { id: 'tower_finance', system: true, story: true,
      build() {
        const t = T(); if (t.stage !== 'finance') return null;
        const P = plan(t.size), f = t.f || 1, cfo = window.Staff && Staff.hasRole && Staff.hasRole('cfo');
        const navPS = GameState.ratios.navPerShare || 0, pnav = navPS > 0 ? GameState.company.sharePrice / navPS : 1;
        const eqDone = GameState.company.equityIssuanceYear === GameState.meta.year;
        return { title: 'How do we pay for ' + NAME + '?', from: cfo ? Staff.getStaff('cfo').name + ', CFO' : 'Jenkins, Chief of Staff', face: cfo ? null : FACE('jenkins'),
          body: 'Construction starts as soon as the money is in place: ' + money(P.build) + ' over 10 quarters. Pick one package for about half of it; the rest comes from our cash, bonds and credit line as usual.' +
                nums([['Each quarter', 'about ' + money(P.build / 10) + ' of building bills'], ['Your cash plus credit line', money(spendable())], ['Debt / assets now', Math.round((GameState.ratios.debtToAssets || 0) * 100) + '%'], ['Share price / NAV', Math.round(pnav * 100) + '%']]) +
                voice('okafor', '"Whatever we choose, nothing comes back for three years."') + voice('petrova', '"No new shares below NAV. Please."'),
          choices: [
            { label: 'Construction loan: up to ' + money(P.build * 0.625), detail: 'From a bank, drawn as we build. Floating: base rate +3% (now ' + ((GameState.market.baseInterestRate || 3) + 3).toFixed(1) + '%). At completion it becomes bonds at whatever rates are then. Counts as debt for your covenant. Chen +0.5.',
              apply() { const m = finance('loan'); remember('chen', 0.5, 'the construction loan'); return m; } },
            { label: 'Preferred shares: ' + money(Math.min(90 * f, Financials.prefRoom())) + ' at ' + (Financials.prefRate() * 100).toFixed(2) + '%', detail: 'The board approves them for the tower only. Not debt: no covenant, no rating hit. ' + money(Math.min(90 * f, Financials.prefRoom()) * Financials.prefRate()) + ' a year to the preferred holders from day one, before any common dividend, while the tower earns nothing. Fixed at the base rate + our spread + 2.5%, callable after 5 years. Okafor and Petrova can live with it.',
              check: () => Financials.prefBoardOK() && Financials.prefRoom() >= 5, checkMsg: Financials.prefBoardOK() ? 'Preferred shares are capped at 30% of total assets' : 'The Chairman will not approve it while the board is this unhappy',
              apply() { const m = finance('pref'); remember('okafor', 0.5, 'no new debt for the tower'); remember('petrova', 0.5, 'no new common shares'); return m; } },
            { label: 'New common shares: about ' + money(Math.min(80 * f, GameState.company.sharesOutstanding * 0.2 * GameState.company.sharePrice)), detail: 'At ' + Math.round(pnav * 100) + '% of NAV (the normal rules: ' + (pnav >= 1 ? 'cheap above NAV' : pnav >= 0.8 ? 'a moderate discount' : 'a harsh discount') + '). ' + (pnav < 1 ? 'Petrova −2.' : ''),
              check: () => !eqDone, checkMsg: 'Already sold shares this year',
              apply() { const m = finance('equity'); if (pnav < 1) remember('petrova', -2, 'new shares below NAV for the tower'); return m; } },
            { label: 'A partner: Fjordhavn takes 49%', detail: 'The Norwegian pension fund pays 49% of everything, including the lot (' + money(t.plotPaid * 0.49) + ' back now), and owns 49% of the rent and the value. Okafor +1, Williams −1 ("half my tower belongs to Norwegians").',
              apply() { return finance('jv'); } },
          ] };
      } },
    { id: 'tower_overrun', system: true, story: true,
      build() {
        const t = T(); if (t.stage !== 'build') return null;
        const over = fmt(t.build * 0.12 * (1 - (window.Agents ? Agents.strength('tower') : 0))), mine = fmt(over * shareOf());
        return { title: NAME + ': steel and lifts 12% over budget', from: 'Brightline Construction', face: null,
          body: 'Our contractor writes: steel prices and the lift contract have gone up. The tower will cost ' + money(over) + ' more' + (t.jv ? ' (' + money(mine) + ' our share)' : '') + '. Five quarters of work are left.' +
                voice('williams', '"Pay it. One does not build a landmark on a budget."') + voice(lead('okafor', 'petrova'), '"Cut the sky lounge. Nobody signs a lease for a lounge."'),
          choices: [
            { label: 'Pay it: ' + money(mine), detail: 'Spread over the remaining five quarters. Williams +0.5.', apply() { t.extra = over; remember('williams', 0.5, 'you paid for his tower'); return 'Brightline thanks you for your understanding.'; } },
            { label: 'Cut the sky lounge', detail: 'Cost back to plan. The tower is worth about 4% less when finished. Williams −1, and Sebastian sulks for a year.', apply() { t.loungeCut = true; t.sebNext = tq() + 4; remember('williams', -1, 'you cut the sky lounge'); return 'The sky lounge is now "a future amenity space". Sebastian did not come to work on Monday.'; } },
            { label: 'Pause for two quarters and renegotiate', detail: 'The overrun halves (' + money(mine / 2) + '); the tower opens two quarters later.', apply() { t.extra = fmt(over / 2); t.paused = 2; return 'Works paused. Brightline is "disappointed but flexible".'; } },
          ] };
      } },
    { id: 'tower_open', system: true, story: true,
      build() {
        const t = T(), p = tower(); if (!p || t.stage !== 'open') return null;
        const A = t.road === 'A', loss = t.impair || 0;
        return { title: A ? NAME + ' opens into a pandemic' : NAME + ' opens: ' + pc(p.occupancy) + ' let', from: NORA + ', ' + PAPER, face: FACE('journalist'),
          body: (A ? 'The ribbon was cut in an empty lobby. A pandemic was declared the same month, and offices nobody has moved into yet are the first to be abandoned. ' + NAME + ' is ' + pc(p.occupancy) + ' let. Buyers now price empty offices at a 7% yield.'
                   : 'A big opening: the mayor, a string quartet, Sebastian in a white suit. But the tower is ' + pc(p.occupancy) + ' let, and buyers will not pay a trophy price for a tower that is not full: a 6.25% yield.') +
                nums([['Cost', money(t.cost)], ['Valued at', money(p.currentValue)], ['Written down', money(loss)], ['Rent after costs now', money(noiAt(p.annualNOI, p.occupancy)) + ' a year (' + money(noiAt(p.annualNOI, 0.92)) + ' when 92% let)']]) +
                (A ? voice(lead('okafor', 'petrova'), '"It is in the minutes from Year 9."') : voice(lead('chen', 'williams'), '"Give it two years."')) +
                '<div class="dv-nums">The board decides what to do with it at the next meeting.</div>',
          choices: [{ label: 'Understood', apply() { return 'The board will take it up at the meeting.'; } }] };
      } },
  ];
  /* round 17: every big cheque can be paid with preferred shares (financials.js prefChoice) */
  const withPref = (c, amt) => { const b = c.build; c.build = function () { const k = b.apply(this, arguments);
    if (k && k.choices && k.choices[0] && window.Financials && Financials.prefChoice) { const a = amt(); if (a > 0) { const pc = Financials.prefChoice(k.choices[0], a, { why: k.title }); k.choices.splice(1, 0, pc); if (Financials.splitChoice) k.choices.splice(2, 0, Financials.splitChoice(k.choices[0], a, { why: k.title }));   /* round 27: or split it */ k.body = (k.body || '') + Financials.prefDebateHTML(pc.rate); } } return k; }; };
  CARDS.forEach(c => { if (c.id === 'tower_plot') withPref(c, () => { const t = T(); return t.size ? plan(t.size).plot * (warOn() ? 1.1 : 1) : 0; }); });
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* The ending card (ending.js). */
  function ending() {
    const t = T();
    if (t.ending) return t.ending;
    if (t.stage === 'held' || t.stage === 'open') return t.road === 'A' ? 'ghost' : 'fine';
    if (t.stage === 'build' || t.stage === 'finance' || t.stage === 'plot' && tower()) return 'unfinished';
    if (t.stage === 'convert') return 'apartments';
    return 'none';
  }
  /* Williams votes against you the year after you refuse his tower. */
  const williamsAgainst = () => !!T().williamsAgainst && T().williamsAgainst === GameState.meta.year;

  function debug(o) { Object.assign(T(), o || {}); return T(); }

  return { T, agenda, noiAt, processQuarter, ending, plan, williamsAgainst, debug, successionItem, tower };
})();
