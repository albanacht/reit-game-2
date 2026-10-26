/* ============================================================================
   ending.js — THE ENDING, like a visual novel (round 14).

   When the run ends (fired, taken over, defaulted, or fifteen years), a short
   sequence plays before the score screen:
     1. YOUR ENDING: one big image and a few lines, the first that applies:
        shown the door · the prey · the receivers · the clean exit ·
        the emperor · divine status · the builder · the rich survivor ·
        the caretaker
     2. WHAT BECAME OF THEM: one card each, from the decisions you made:
        Bob Harlow, Brett Kessler, Celestial Heights, Williams and Sebastian,
        the index, your board (faces then and now), and you.
   The text states facts, never verdicts (design doc: complicity, not satire).

   Images: assets/endings/<key>.jpg. Until a file exists the card falls back
   to an existing photo or portrait, then to a plain panel naming the file it
   wants (ENDING_IMAGE_PROMPTS.md has a prompt for each).
   ========================================================================== */

window.Ending = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const pctA = n => (n >= 0 ? '' : '−') + Math.abs(n * 100).toFixed(1) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const has = id => window.Directors && Directors.has(id);
  const nm = id => window.Directors ? Directors.name(id).replace(/^(Chairman|Chair|Director) /, '') : id;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const RICH = 18;                                     // $M of your own: "rich"
  const DIVINE_W = 25, DIVINE_GAP = 0.02;              // divine: $25M+ AND 2+ points a year over the rivals AND not on probation

  /* -- the facts ---------------------------------------------------------------- */
  function facts() {
    const G = GameState, years = Math.max(0.25, (G.meta.totalQuarters || 0) / 4);
    const p0 = G._p0 || (G.history && G.history[0] && G.history[0].sharePrice) || G.company.sharePrice;
    const divs = (G.history || []).reduce((a, h) => a + (h.dividendPerShare || 0), 0);
    const tsr = p0 ? (G.company.sharePrice + divs) / p0 - 1 : 0;
    const ann = r => Math.pow(Math.max(0.0001, 1 + r), 1 / years) - 1;
    let rivals = null;
    try { const L = Rivals.league(4).filter(r => r.key !== 'you'); if (L.length) rivals = L.reduce((a, r) => a + r.since, 0) / L.length; } catch (e) {}
    const w = window.Pay ? Pay.wealth() : { total: 0, forfeited: 0 };
    return { years, tsr, tsrA: ann(tsr), rivals, rivalsA: rivals == null ? null : ann(rivals), beat: rivals == null ? tsr > 0 : tsr > rivals, wealth: w.total, forfeited: w.forfeited || 0 };
  }

  /* -- 1. your ending ------------------------------------------------------------- */
  function kind() {
    const G = GameState, why = G.meta.gameOverReason || '';
    if (window.War && War.W().ending === 'prey') return 'prey';
    if (/voted .* to remove you|board voted/i.test(why)) return 'fired';
    if (/administrators|defaulted|owes more than it owns/i.test(why)) return 'receivers';
    if (G.meta.resigned) return 'exit';
    const f = facts();
    if (G.board.chair === 'you') return 'emperor';
    if (f.beat && f.wealth >= DIVINE_W && (f.rivalsA == null || f.tsrA - f.rivalsA >= DIVINE_GAP) && !G.board.probation) return 'divine';
    if (f.beat) return 'builder';
    if (f.wealth >= RICH) return 'rich';
    return 'caretaker';
  }
  function mainCard() {
    const G = GameState, f = facts(), k = kind(), co = G.company.name;
    const ret = 'Shareholders made ' + pctA(f.tsrA) + ' a year' + (f.rivalsA != null ? '; the rivals made ' + pctA(f.rivalsA) + '.' : '.');
    const you = 'You made ' + money(f.wealth) + (f.forfeited ? ', and left ' + money(f.forfeited) + ' of unvested shares behind.' : '.');
    const yrs = Math.round(f.years * 4) / 4, Y = yrs === 1 ? 'one year' : (Number.isInteger(yrs) ? yrs : yrs.toFixed(1)) + ' years';
    const T = {
      fired:     ['Shown the door', [Y + ' as CEO of ' + co + '. The board voted you out.', ret, you, 'Security walked you to the lift. Jenkins carried the box.']],
      prey:      ['The prey', ['Rennick Capital took over ' + co + ' after ' + Y + '.', 'Brett Kessler kept the buildings and moved into your office.', ret, you]],
      receivers: ['The receivers', [Y + '. ' + co + ' owed more than it owned, and the lenders took the keys.', ret, you, 'The administrators changed the locks on a Tuesday.']],
      exit:      ['The clean exit', ['You resigned after ' + Y + ' and walked out with what had vested.', ret, you]],
      emperor:   ['The emperor', ['Fifteen years. You ended them as chairman and CEO of ' + co + ', setting the agenda of the board that set your pay.', ret, you]],
      divine:    ['Divine status', ['Fifteen years as CEO of ' + co + '.', ret, you, 'The portrait in the lobby is yours now.']],
      builder:   ['The builder', ['Fifteen years as CEO of ' + co + ', ' + G.portfolio.length + ' buildings at the end.', ret, you]],
      rich:      ['The rich survivor', ['Fifteen years as CEO of ' + co + '.', ret, you]],
      caretaker: ['The caretaker', ['Fifteen years as CEO of ' + co + '. The lights stayed on.', ret, you]],
    }[k];
    // round 21: the liquidator. Facts only: what you sold, what was left.
    const br = G.board.brain || {}, boughtN = (br.buys || []).reduce((t, x) => t + x.n, 0);
    if ((br.soldN || 0) >= 4 && br.soldN > boughtN)
      T[1].splice(1, 0, 'You sold ' + br.soldN + ' buildings for ' + money(br.soldV || 0) + ' and bought ' + boughtN + '. The company owned ' + G.portfolio.length + ' at the end.');
    const fall = { fired: FACE('williams'), prey: FACE('ceo_ren'), receivers: 'assets/photos/office_tier2_a.jpg', emperor: 'assets/board/boardroom2.png', divine: 'assets/board/boardroom2.png', builder: 'assets/photos/supertower.jpg', rich: 'assets/photos/multifamily_tier1_a.jpg', caretaker: 'assets/photos/office_suburban_a.jpg', exit: 'assets/photos/office_tier1_a.jpg' }[k];
    // round 29: two pictures for being fired; the company name picks one, so a run always shows the same
    const key = k === 'fired' && [...String(co)].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 ? 'ending_fired2' : 'ending_' + k;
    return { key, fallback: fall, label: 'Your ending', title: T[0], lines: T[1], big: true };
  }

  /* -- 2. what became of them ------------------------------------------------------ */
  function cards() {
    const out = [], G = GameState;
    // Bob Harlow
    const h = window.Story && Story.H ? Story.H() : null;
    if (h && h.stage !== 'wait') {
      const r = h.result, dcMine = (G.portfolio || []).some(p => p.id === 'ind_hdc');
      const v = (r === 'healthy' || r === 'survived' || r === 'repaid') ? ['harlow_thriving', 'Harlow Grocers runs 140 stores now. Bob still has the yacht.', 'He sends a card every Christmas. It is always late.']
              : r === 'refinanced' ? ['harlow_cold', 'Bob refinanced with another lender and repaid us in full.', 'He never called again.']
              : r === 'partial' ? ['harlow_cold2', 'Harlow sold six stores to repay most of what it owed.', 'Bob runs what is left, from a smaller office.']
              : r === 'bust' ? ['harlow_bust', 'Harlow Grocers went bankrupt. The yacht was sold at auction.', 'Bob consults for grocery chains now. His first slide is about leverage.']
              : !dcMine && !h.loan ? ['harlow_never', 'You never did business with Bob Harlow.', 'Harlow Grocers was bought by a national chain in the end.']
              : ['harlow_thriving', 'Harlow Grocers is still your tenant.', 'Bob still calls Hassan on his birthday.'];
      out.push({ key: v[0], fallback: FACE('bob'), label: 'Bob Harlow', lines: [v[1], v[2]] });
    }
    // Brett Kessler
    if (window.War) {
      const w = War.W(), e = w.ending || (w.stage === 'crisis' || w.blocked ? 'siege' : w.stage === 'war' ? 'cold' : null);
      const K = { takeover: ['kessler_golf', 'Rennick Capital is part of ' + G.company.name + '. Brett Kessler plays golf in Florida.', 'He still says second place is the first loser. Nobody asks him who came first.'],
                  siege: ['kessler_shadow', 'Rennick survived, smaller, after every sale you blocked.', 'Kessler runs it from one floor of the building he once wanted to buy from Jack.'],
                  truce: ['kessler_truce', 'Rennick and ' + G.company.name + ' are still across the street from each other.', 'Kessler and Williams have lunch twice a year.'],
                  prey: ['kessler_prey', 'Brett Kessler sits at your desk.', 'He kept the plant in the corner. He watered it once.'],
                  none: ['kessler_landlord', 'Kessler bought Morrow Plaza from Jack, and much else.', 'Rennick is Riverton’s biggest landlord.'],
                  cold: ['kessler_cold', 'The war with Rennick never ended. It just got quieter.', 'Nora Whitlock still has both your numbers.'] }[e];
      if (K) out.push({ key: K[0], fallback: FACE('ceo_ren'), label: 'Brett Kessler', lines: [K[1], K[2]] });
    }
    // Celestial Heights
    if (window.Tower) {
      const t = Tower.T(), e = Tower.ending(), p = Tower.tower();
      const C = { trophy: ['tower_trophy', 'Celestial Heights is full. It is the building on every postcard of Riverton.', 'Williams’s name is on the lobby wall.'],
                  ghost: ['tower_ghost', 'Celestial Heights is still half empty. The Ledger calls it "the ghost tower".', 'The sky lounge lights come on at night for nobody.'],
                  fine: ['tower_fine', 'Celestial Heights is ' + (p ? Math.round(p.occupancy * 100) : 75) + '% let. A good building, not a landmark.', 'Sebastian still calls it "the vision".'],
                  sold: ['tower_sold', 'Celestial Heights belongs to someone else now.', (GameState.rivals && GameState.rivals.ren && !GameState.rivals.ren.gone) ? 'The new owner renamed it. Kessler\u2019s name is on the door now.' : 'The new owner renamed it.'],
                  apartments: ['tower_apartments', 'Celestial Heights is apartments now. Mostly let.', 'The residents love the sky lounge.'],
                  never: ['tower_carpark', 'The Fifth Street lot is still a car park.', 'Williams parks there on Tuesdays and looks up.'],
                  unfinished: ['tower_crane', 'Celestial Heights was still a building site when you left.', 'Your successor will cut the ribbon.'] }[e];
      if (C) out.push({ key: C[0], fallback: e === 'never' ? 'assets/photos/land_downtown_a.jpg' : 'assets/photos/supertower.jpg', label: 'Celestial Heights', lines: [C[1], C[2]] });
      // Williams and Sebastian
      if (t.seb || t.williamsGone) {
        const W = t.williamsGone === 'fell' ? ['williams_fell', 'Williams stepped down after the tower. Sebastian opened a nightclub in Dubai.', 'It is called Celestial.']
                : t.williamsGone ? ['williams_honour', 'Williams retired' + (t.williamsGone === 'honour' ? ' with honour. His name is on the lobby wall of the tower.' : '. He sails now.'), 'Sebastian left for "a project in Dubai".']
                : ['williams_honour', 'Williams chaired the board to the end.', 'Sebastian is still Chief Vision Officer. Nobody knows what he does.'];
        out.push({ key: W[0], fallback: FACE('williams'), label: 'Williams and Sebastian', lines: [W[1], W[2]] });
      }
    }
    // Gary
    if (window.Gary && Gary.ending() !== 'none') {
      const g = Gary.S(), e = Gary.ending();
      const R = { dock: ['gary_dock', 'Gary sold Lakeside and bought a second lake house.', 'You own a share of the dock.' + (g.sold ? ' Your 40% came to ' + money(g.sold) + '.' : '')],
                  rennick: ['gary_rennick', 'Gary sold Lakeside to Rennick Capital.', 'Kessler sent him a fruit basket. Gary still says it was the right call.'],
                  still: ['gary_still', 'Gary still manages your buildings.', g.earned > 0 ? 'Your share of Lakeside paid you ' + money(g.earned) + '.' : 'The lake house is booked for August, as always.'],
                  thanksgiving: ['gary_thanksgiving', 'You have not been invited to Thanksgiving since Year ' + (g.endedYear || '') + '.', 'Gary tells the story every year, to everyone else.'],
                  notfamily: ['gary_never', 'The board turned Gary down. He went back to running the family scrap yard.', 'He still says the board "is not family".'],
                  never: ['gary_never', 'Gary never got the contract. He runs the family scrap yard now.', 'He still brings it up, usually over the noise of the crusher.'] }[e];
      if (R) out.push({ key: R[0], fallback: FACE('gary'), label: 'Gary, your brother-in-law', lines: [R[1], R[2]] });
    }
    // round 30: the old yard (gary.js)
    if (window.Gary && Gary.yardEnding && Gary.yardEnding()) {
      const e = Gary.yardEnding(), y = Gary.Y();
      out.push({ key: 'yard_' + e, fallback: 'assets/photos/industrial_riverside_salvage.jpg', label: 'The old yard',
        lines: e === 'exposed' ? ['The Ledger ran "The CEO\u2019s scrap yard" on page one.', 'Riverside Salvage still pays the rent. Petrova still brings it up.']
                               : ['Riverside Salvage still leases the old yard from ' + G.company.name + '.', 'Your half of the premium came to ' + money(y.mine || 0) + '. Gary calls it "our little arrangement".'] });
    }
    // Eleanor and Port Logistics
    if (window.Port && Port.ending() !== 'none') {
      const e = Port.ending(), pp = Port.P(), own = (G.portfolio || []).some(b => b.id === 'ind_02');
      const L = own && (e === 'owned' || e === 'won' || e === 'settled' || e === 'blamed') ? ['eleanor_card', 'Eleanor sends a Christmas card every year. It always has a fire extinguisher on it.', e === 'owned' ? 'Atlas Cold Chain still pays the rent on time, every quarter.' : 'Port Logistics is yours. The lawsuit is a framed copy in your drawer.']
              : e === 'lost' ? ['eleanor_ruling', 'Eleanor framed the court ruling. It hangs in Wexmoor\u2019s lobby.', 'Mayor Kowalczyk did not run again.']
              : e === 'blamed' || e === 'settled' ? ['eleanor_ruling', 'Eleanor settled, and tells the story at every industry dinner.', pp.blamed ? Directors.name(pp.blamed).replace(/^(Director|Chair) /, '') + ' has not spoken to you since.' : 'Nobody at Wexmoor returns your calls.']
              : ['eleanor_held', 'Eleanor still owns Port Logistics. Atlas renewed for twenty years.', 'Nice try, she says, whenever she sees you.'];
      out.push({ key: L[0], fallback: FACE('ceo_wex'), label: 'Eleanor Whitcombe', lines: [L[1], pp.mayor ? L[2] + ' Frank Kowalczyk was re-elected twice.' : L[2]] });
    }
    // Levi
    if (window.Levi && Levi.ending() !== 'none') {
      const e = Levi.ending(), l = Levi.L();
      const V = { stayed: ['Levi is still there. His fifth paper was accepted: "Residuals of a Real Estate Company (n = 1)".', l.hits + ' of his challenges met. He has framed none of them.'],
                  quit: ['Levi resigned and wrote a paper about you.', 'It has been cited twice. Both times by Levi.'],
                  passed: ['Levi went to work for Eleanor at Wexmoor.', 'Wexmoor saw the crisis coming.'] }[e];
      if (V) out.push({ key: 'levi_' + e, fallback: FACE('levi'), label: 'Dr. Levi Cohen', lines: V });
    }
    // Tex
    const texEver = has('tex') || (G.board.history || []).some(h => /Tex/.test(h.text || ''));
    if (texEver) {
      const viaGranite = window.IndexFund && IndexFund.X().asks && IndexFund.X().asks.tex === 'agreed';
      const T = has('tex') ? ['tex_still', 'Tex is still on the board.', 'He still calls you partner, and still votes with you.']
              : viaGranite ? ['tex_gone', 'Tex stepped down when Granite asked.', 'He sent a bottle of bourbon anyway.']
              : ['tex_gone', 'Tex left the board after the Ledger story.', 'He is back in Dallas, buying strip malls.'];
      out.push({ key: T[0], fallback: FACE('tex'), label: 'Tex Brennan', lines: [T[1], T[2]] });
    }
    // the index
    if (window.IndexFund) {
      const e = IndexFund.ending();
      const I = { in: ['index_in', 'Index funds own 15% of ' + G.company.name + ' and cannot sell.', 'Granite’s Henrik Dahl votes on your successor’s pay every year.'],
                  dropped: ['index_out', G.company.name + ' was in the ' + IndexFund.INDEX + ' once.', 'Index funds sold on the day it was dropped.'] }[e];
      if (I) out.push({ key: I[0], fallback: FACE('dahl'), label: 'The ' + IndexFund.INDEX, lines: [I[1], I[2]] });
    }
    // round 29: where are they now, your directors (ENDING_TEXTS_review.md section 4)
    directors(out);
    // your board, then and now
    const start = G.board.startBoard || ['williams', 'petrova', 'chen', 'okafor', 'hassan'], now = (G.board.directors || []).map(d => d.id);
    const gone = start.filter(id => now.indexOf(id) < 0), came = now.filter(id => start.indexOf(id) < 0);
    out.push({ key: null, label: 'Your board', faces: { start, now },
      lines: [gone.length ? 'Left: ' + gone.map(nm).join(', ') + '.' : 'Nobody left the board.', came.length ? 'Joined: ' + came.map(nm).join(', ') + '.' : 'Nobody new joined.',
              G.board.chair === 'you' ? 'You chaired it.' : 'Chair at the end: ' + nm(Directors.chair()) + '.'] });
    // you
    const f = facts(), tier = f.wealth >= 30 ? ['you_island', 'An island.'] : f.wealth >= 12 ? ['you_vineyard', 'A vineyard.'] : ['you_lakehouse', 'A lake house.'];
    out.push({ key: tier[0], fallback: 'assets/photos/multifamily_suburban_a.jpg', label: 'You', lines: [tier[1], money(f.wealth) + ' of your own' + (f.forfeited ? ', ' + money(f.forfeited) + ' left behind in unvested shares' : '') + '.'] });
    return out;
  }

  /* Petrova, Chen, Okafor, Hassan (if they were on your board at the start) and
     Jenkins, each from what you did to them. */
  function directors(out) {
    const G = GameState, H = G.history || [], f = facts(), start = G.board.startBoard || ['williams', 'petrova', 'chen', 'okafor', 'hassan'];
    const was = id => start.indexOf(id) > -1 || has(id);
    const peakD2A = H.reduce((m, h) => Math.max(m, h.debtToAssets || 0), 0);
    const sold = Math.max(0, (G.company.sharesOutstanding || 10) - (G.company.compShares || 0)) / 10 - 1;   // shares sold for money since day one
    const bought = ((G.board.brain || {}).buys || []).reduce((t, x) => t + x.n, 0);
    const hb = window.Story && Story.H ? Story.H() : null, port = window.Port ? Port.P() : null;
    const card = (id, key, a, b) => out.push({ key, fallback: FACE(id), label: id === 'jenkins' ? 'Jenkins' : nm(id), lines: [a, b] });
    if (was('petrova')) {
      if (f.beat) card('petrova', 'petrova_fund', 'Petrova runs her own fund now.', 'Your returns are on page 3 of her pitch deck.');
      else if (sold > 0.3) card('petrova', 'petrova_oped', 'Petrova wrote an opinion piece on share dilution.', 'Your company is the example. It was syndicated.');
    }
    if (was('chen')) {
      if (port && port.leaked && port.blamed === 'chen') card('chen', 'chen_consultant', 'Chen is a consultant now.', 'His profile says "value creation".');
      else if (bought >= 6) card('chen', 'chen_ceo', 'Chen is CEO of a rival REIT.', 'He is buying your old buildings.');
    }
    if (was('okafor')) {
      if (peakD2A <= 0.52) card('okafor', 'okafor_bank', 'Okafor chairs the audit committee of a large bank.', 'He still reads every footnote.');
      else card('okafor', 'okafor_teacher', 'Okafor teaches a course on bond covenants.', 'You are week three.');
    }
    if (was('hassan')) {
      if (hb && hb.result === 'bust') card('hassan', 'hassan_mall', 'Hassan manages a small strip mall in Ohio.', 'Every unit is let.');
      else card('hassan', 'hassan_farm', 'Hassan retired to a farm.', 'He still checks the occupancy of the barn.');
    }
    card('jenkins', 'jenkins_next', 'Jenkins is chief of staff to your successor.', 'Who calls him "boss".');
  }

  /* -- round 32: what went wrong (the game over screen, when the run ended early) --------
     Built from your own history: the few numbers that sank you, worst first. */
  function postmortem() {
    const G = GameState, H = G.history || [], out = [], pc = n => Math.round(n * 100) + '%';
    if (H.length < 2) return out;
    const first = H[0], last = H[H.length - 1];
    const peak = H.reduce((m, h) => Math.max(m, h.debtToAssets || 0), 0);
    if (peak >= 0.55) out.push([3, 'Debt reached ' + pc(peak) + ' of assets. Okafor\u2019s line is 55%; your bonds stop at 60%.']);
    const R = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'], r0 = R.indexOf(first.creditRating || 'BBB'), r1 = R.indexOf(G.credit.rating);
    if (r1 > r0) out.push([2 + r1 - r0, 'Your credit rating fell from ' + R[r0] + ' to ' + R[r1] + ': every new loan cost more (lenders charge ' + ({ A: '1.2', BBB: '1.8', BB: '3', B: '4.5', CCC: '7' }[R[r1]] || '?') + ' points over the base rate at ' + R[r1] + ').']);
    const bl = (G.portfolio || []).filter(p => !p.underConstruction), val = bl.reduce((t, p) => t + p.currentValue, 0), noi = bl.reduce((t, p) => t + p.annualNOI * p.occupancy, 0);
    const debt = (G.debtTranches || []).reduce((t, d) => t + d.amount, 0), cost = debt > 0 ? (G.debtTranches || []).reduce((t, d) => t + d.amount * d.rate, 0) / debt : 0;
    if (val > 0 && cost > 0 && cost > noi / val * 100 - 0.5) out.push([3, 'Your buildings earn ' + (noi / val * 100).toFixed(1) + '% on their value; your debt costs ' + cost.toFixed(1) + '%. Borrowing to buy lost money.']);
    const pr = window.Financials && Financials.payoutRatio ? Financials.payoutRatio() : null;
    if (pr != null && pr > 1) out.push([2, pr >= 9 ? 'You paid a dividend with no cash profit behind it.' : 'You paid out ' + pc(pr) + ' of your cash profit as dividends: the difference came out of the company.']);
    const a0 = H.slice(0, 4).reduce((t, h) => t + (h.affoPerShare || 0), 0), a1 = H.slice(-4).reduce((t, h) => t + (h.affoPerShare || 0), 0);
    if (H.length >= 8 && a1 < a0 * 0.85) out.push([2, 'Cash profit per share fell from $' + a0.toFixed(2) + ' to $' + a1.toFixed(2) + ' a year.']);
    const f = facts();
    if (f.rivalsA != null && f.tsrA < f.rivalsA - 0.01) out.push([1, 'Shareholders made ' + pctA(f.tsrA) + ' a year; the rivals made ' + pctA(f.rivalsA) + '. Petrova judges you on that gap.']);
    const rev = G.board._lastReview || [], missed = rev.filter(r => r.achieved === false && !r.skipped).length, broken = (G.board._lastPromises || []).filter(p => !p.kept).length;
    if (missed || broken) out.push([2, (missed ? missed + ' of last year\u2019s demands missed' : '') + (missed && broken ? ', and ' : '') + (broken ? broken + ' promise' + (broken > 1 ? 's' : '') + ' broken (a broken promise costs more than no promise)' : '') + '.']);
    const against = (G.board.directors || []).filter(d => d.attitude < 3 && d.id !== 'voss').map(d => nm(d.id) + ': ' + (window.Directors ? Directors.card(d.id).cause : ''));
    if (against.length) out.push([1, 'Unhappy at the end: ' + against.join('; ') + '.']);
    return out.sort((a, b) => b[0] - a[0]).slice(0, 5).map(x => x[1]);
  }

  /* -- the screen -------------------------------------------------------------------- */
  function img(c) {
    if (c.faces) {
      const row = ids => ids.map(id => '<img src="' + FACE(id) + '" alt="" title="' + esc(nm(id)) + '">').join('');
      return '<div class="en-faces"><div><span>Year 1</span>' + row(c.faces.start) + '</div><div><span>The end</span>' + row(c.faces.now) + '</div></div>';
    }
    const want = 'assets/endings/' + c.key + '.jpg';
    return '<div class="en-img"><img src="' + want + '" data-fb="' + esc(c.fallback || '') + '" data-want="' + esc(want) + '" alt=""><div class="en-ph hidden">' + esc(want) + '</div></div>';
  }
  function wireImg(root) {
    root.querySelectorAll('.en-img img').forEach(im => {
      im.onerror = () => {
        const fb = im.dataset.fb;
        if (fb && im.getAttribute('src') !== fb) { im.src = fb; im.classList.add('en-fb'); return; }
        im.style.display = 'none'; im.nextElementSibling.classList.remove('hidden');
      };
    });
  }
  /* -- round 25: the ending gallery. Endings you have seen are remembered in
     this browser across games (not in the save), and shown on the title
     screen: a collection to complete, like finisher medals. -------------- */
  const GKEY = 'reitsim2.endings';
  const ALL = [
    ['divine', 'Divine status', 'Fifteen years, two points a year ahead of the rivals, $25M of your own, never on probation.'],
    ['emperor', 'The emperor', 'Fifteen years, ending as chairman and CEO.'],
    ['builder', 'The builder', 'Fifteen years, ahead of the rivals.'],
    ['rich', 'The rich survivor', 'Fifteen years, $18M of your own.'],
    ['caretaker', 'The caretaker', 'Fifteen years. Just make it to the end.'],
    ['exit', 'The clean exit', 'Resign while you are ahead.'],
    ['fired', 'Shown the door', 'Lose the board vote.'],
    ['receivers', 'The receivers', 'Run out of money.'],
    ['prey', 'The prey', 'Let Rennick take you over.'],
  ];
  function gallery() { try { return JSON.parse(localStorage.getItem(GKEY)) || { main: {}, cards: {} }; } catch (e) { return { main: {}, cards: {} }; } }
  function record(k, pages) {
    const g = gallery(), G = GameState, isNew = !g.main[k];
    if (isNew) g.main[k] = { co: G.company.name, y: G.meta.year };
    pages.slice(1).forEach(c => { if (c.key && !g.cards[c.key]) g.cards[c.key] = c.label; });
    try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch (e) {}
    return { isNew, found: Object.keys(g.main).length };
  }
  function galleryHTML() {
    const g = gallery(), n = Object.keys(g.main).length, stories = Object.keys(g.cards).length;
    return '<details class="eg"><summary class="eg-h"><b>Endings found: ' + n + ' of ' + ALL.length + '</b> <span class="eg-stars">' + ALL.map(x => g.main[x[0]] ? '\u2605' : '\u2606').join('') + '</span>' + (stories ? ' <span>· ' + stories + ' story outcome' + (stories === 1 ? '' : 's') + ' seen</span>' : '') + '</summary><div class="eg-grid">' +
      ALL.map(a => { const f = g.main[a[0]];
        return '<div class="eg-c' + (f ? ' on' : '') + '" title="' + esc(a[2]) + '"><div class="eg-img">' + (f ? '<img src="assets/endings/ending_' + a[0] + '.jpg" alt="" onerror="this.remove()">' : '') + '<span>' + (f ? '\u2605' : '?') + '</span></div>' +
               '<div class="eg-t">' + esc(a[1]) + '</div><div class="eg-s">' + (f ? esc(f.co) + ', Year ' + f.y : esc(a[2])) + '</div></div>'; }).join('') + '</div></details>';
  }

  function show(done) {
    const pages = [mainCard()].concat(cards());
    if (window.Telemetry) Telemetry.ending(kind());   // round 23
    const rec = record(kind(), pages);
    if (rec.isNew) pages[0].badge = 'New ending unlocked: ' + rec.found + ' of ' + ALL.length;
    let i = 0;
    let o = document.getElementById('ending-overlay');
    if (!o) { o = document.createElement('div'); o.id = 'ending-overlay'; document.body.appendChild(o); }
    const render = () => {
      const c = pages[i], last = i === pages.length - 1;
      o.innerHTML = '<div class="en-box' + (c.big ? ' en-big' : '') + '">' + img(c) +
        '<div class="en-text">' + (c.badge ? '<div class="en-badge">\u2605 ' + esc(c.badge) + '</div>' : '') + '<div class="en-label">' + esc(c.label) + (i > 0 ? ' · what became of them' : '') + '</div>' + (c.title ? '<h1>' + esc(c.title) + '</h1>' : '') +
        c.lines.map(l => '<p>' + esc(l) + '</p>').join('') +
        '<div class="en-nav"><span class="en-dots">' + pages.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') + '</span>' +
        (i > 0 ? '<button class="en-back">Back</button>' : '') +
        (last && window.Telemetry ? '<button class="en-back en-fb">Rate the game</button>' : '') +
        '<button class="en-next">' + (last ? 'The scores' : 'Next') + '</button>' +
        (!last ? '<button class="en-skip">Skip to the scores</button>' : '') + '</div></div></div>';
      o.classList.remove('hidden'); wireImg(o);
      const fin = () => { o.classList.add('hidden'); if (done) done(); };
      o.querySelector('.en-next').onclick = () => { if (last) fin(); else { i++; render(); } };
      const bk = o.querySelector('.en-back:not(.en-fb)'); if (bk) bk.onclick = () => { i--; render(); };
      const fb = o.querySelector('.en-fb'); if (fb) fb.onclick = () => Telemetry.openFeedback();
      const sk = o.querySelector('.en-skip'); if (sk) sk.onclick = fin;
    };
    render();
  }

  return { show, kind, facts, mainCard, cards, RICH, DIVINE_W, gallery, galleryHTML, ALL, postmortem };
})();
