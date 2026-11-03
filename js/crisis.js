/* ============================================================================
   crisis.js — round 38: tools for fighting a crisis, and the board's memory of it.
   window.Crisis

   In a crisis (or the aftershock):
   - The emergency dividend cut (financials.js) is allowed, covered or not:
     Williams −1, Okafor +1.
   - Pledge the dividend back (Williams's own lever): promise to restore it
     within 4 quarters after the crisis ends. Williams +1 now; miss it and he is
     −3, and you lose 1 political capital.
   - Ask the market for trust (Dealroom): once per crisis, 1 political capital,
     $0.1M. Share price +3% for 2 quarters, Petrova +1.
   - A lease-up, or incentives on an empty building: Hassan (or Mansour) +0.5,
     once a quarter.
   After the crisis, once the dividend is covered again, Williams asks at the
   meeting for the pre-crisis dividend: restore it now (+1), halfway now and the
   rest within 4 quarters (−0.5 now, −3 if missed), or refuse (−3).
   ========================================================================== */

window.Crisis = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const aq = () => (GameState.totalQuartersElapsed ? GameState.totalQuartersElapsed() : tq());   // Arc's clock
  const phase = () => (window.Arc && Arc.phase ? Arc.phase() : '');
  const inCrisis = () => ['crisis', 'aftershock'].indexOf(phase()) > -1;
  const has = id => window.Directors && Directors.has(id);
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const C = () => GameState._crisis || (GameState._crisis = { trust: {}, creditQ: -1 });
  const pc = () => (GameState.board.politicalCapital || 0);
  const spendPC = n => { GameState.board.politicalCapital = Math.max(0, pc() - n); };
  const div = () => GameState.company.dividendPerShare || 0;
  const yq = q => 'Year ' + (Math.floor((q - 1) / 4) + 1) + ' Q' + ((q - 1) % 4 + 1);
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const say = (text, cat) => { if (window.News && News.add) News.add(text, cat || 'dividend'); };

  /* -- Hassan: fighting for tenants in a crisis ------------------------------- */
  function credit() {
    if (!inCrisis() || C().creditQ === tq()) return;
    const who = has('hassan') ? 'hassan' : has('mansour') ? 'mansour' : null; if (!who) return;
    C().creditQ = tq();
    remember(who, 0.5, 'you fought to fill the buildings in the crisis');
  }

  /* -- Williams: pledge the dividend back ------------------------------------- */
  function canPledge() {
    const G = GameState, e = G._eCut;
    if (!inCrisis() || !e || e.restored) return { ok: false, show: false };
    if (G._pledge) return { ok: false, show: true, why: 'Pledged: back to $' + G._pledge.from.toFixed(2) + ' by ' + yq(G._pledge.dueTq) };
    return { ok: true, show: true };
  }
  function pledge() {
    const c = canPledge(), G = GameState, a = G.arc; if (!c.ok) return { success: false, message: c.why || 'Not now.' };
    const end = phase() === 'aftershock' ? a.afterEnd : a.crisisEnd;   // Arc quarters
    const dueTq = tq() + Math.max(1, end - aq()) + 4;
    G._pledge = { from: G._eCut.from, dueTq, q: tq() };
    remember('williams', 1, 'you pledged the dividend back');
    say(G.company.name + '’s CEO pledges to restore the full dividend once the downturn ends.');
    return { success: true, message: 'You told the shareholders: the full $' + G._eCut.from.toFixed(2) + ' comes back within a year of the crisis ending (by ' + yq(dueTq) + '). Williams: "That is a man I can stand behind." Miss it: Williams −3 and 1 political capital.' };
  }

  /* -- Petrova: ask the market for trust (Dealroom) ---------------------------- */
  function canTrust() {
    if (!inCrisis()) return { ok: false, show: false };
    if (C().trust[phase()]) return { ok: false, show: true, why: 'Done once in this ' + (phase() === 'crisis' ? 'crisis' : 'aftershock') };
    if (pc() < 1) return { ok: false, show: true, why: 'Needs 1 political capital' };
    if (spendable() < 0.1) return { ok: false, show: true, why: 'Not enough cash' };
    return { ok: true, show: true };
  }
  function trust() {
    const c = canTrust(), G = GameState; if (!c.ok) return { success: false, message: c.why || 'Not now.' };
    C().trust[phase()] = true; spendPC(1);
    G._pendingUnusual = fmt((G._pendingUnusual || 0) - 0.1);
    if (window.PR && PR.P) PR.P().boosts.push({ id: 'trust', name: 'You asked the market for trust', lift: 0.03, until: tq() + 2 });
    remember('petrova', 1, 'you faced the shareholders in the crisis');
    say(G.company.name + '’s CEO to shareholders: "We have the cash, the covenants and the buildings. We are not going anywhere."', 'capital');
    return { success: true, message: 'A short video to the shareholders, then every call they asked for. Share price +3% for 2 quarters. Petrova +1. ($0.1M, 1 political capital.)' };
  }

  /* -- after the crisis: Williams wants it back -------------------------------- */
  function fullCovered() {   // would the pre-crisis dividend be paid from cash profit?
    const e = GameState._eCut, pr = Financials.payoutRatio ? Financials.payoutRatio() : null;
    if (!e || pr == null || div() <= 0) return false;
    return pr * e.from / div() <= 1.0;
  }
  const frozen = () => !!(window.Revolver && Revolver.dividendFrozen && Revolver.dividendFrozen());
  function agenda(year, items) {
    const G = GameState, e = G._eCut;
    if (!e || e.restored || inCrisis() || !has('williams')) return;
    if (div() >= e.from - 0.005) { e.restored = true; return; }
    const pr = Financials.payoutRatio ? Financials.payoutRatio() : null;
    if (G._pledge) {
      items.push({ lines: [['williams', 'The storm has passed. You gave the shareholders your word: $' + G._pledge.from.toFixed(2) + ' a share by ' + yq(G._pledge.dueTq) + '. I have not forgotten it.']], effect: () => '' });
      return;
    }
    if (G._restore) {
      items.push({ lines: [['williams', 'Halfway is not all the way, son. The rest by ' + yq(G._restore.dueTq) + ', as agreed.']], effect: () => '' });
      return;
    }
    if (pr == null || pr > 1.0) return;   // not covered yet: he waits
    const half = fmt(div() + (e.from - div()) / 2), okFull = fullCovered() && !frozen();
    items.push({ lines: [['williams', 'The storm has passed. We cut the dividend to $' + div().toFixed(2) + ' to get through it. I want it back where it was: $' + e.from.toFixed(2) + ' a share.'],
                         [has('okafor') ? 'okafor' : 'petrova', 'As long as we can pay it from what we earn.']],
      title: 'Williams wants the dividend back',
      choices: [
        { label: 'Restore it now: $' + e.from.toFixed(2) + ' a share', primary: true, detail: 'Williams +1.',
          disabled: !okFull, why: frozen() ? 'Your bank has frozen dividend increases' : 'The full dividend would not be covered by cash profit yet',
          go: () => { G.company.dividendPerShare = e.from; e.restored = true; remember('williams', 1, 'you restored the dividend');
                      say(G.company.name + ' restores its full dividend after the downturn.'); return 'The dividend is back to $' + e.from.toFixed(2) + '. Williams: "That is what I wanted to hear."'; } },
        { label: 'Halfway now ($' + half.toFixed(2) + '), the rest within a year', detail: 'Williams −0.5 now. Miss the full dividend by then: −3.',
          disabled: frozen(), why: 'Your bank has frozen dividend increases',
          go: () => { G.company.dividendPerShare = half; G._restore = { from: e.from, dueTq: tq() + 4 }; remember('williams', -0.5, 'only half the dividend back');
                      return 'The dividend goes to $' + half.toFixed(2) + ' now; the full $' + e.from.toFixed(2) + ' by ' + yq(tq() + 4) + '.'; } },
        { label: 'Refuse: keep it where it is', detail: 'Williams −3.',
          go: () => { e.restored = 'refused'; remember('williams', -3, 'you refused to restore the dividend'); return 'Williams said nothing for a long time. Then: "I see."'; } },
      ] });
  }

  /* -- each quarter: promises kept or broken ----------------------------------- */
  function processQuarter(out) {
    const G = GameState, now = tq();
    [['_pledge', 'your pledge to restore the dividend'], ['_restore', 'your promise to restore the dividend']].forEach(([k, what]) => {
      const p = G[k]; if (!p) return;
      if (div() >= p.from - 0.005) {
        G[k] = null; if (G._eCut) G._eCut.restored = true;
        remember('williams', 0.5, 'you kept ' + what);
        out.push({ good: true, text: 'You kept ' + what + ': the full $' + p.from.toFixed(2) + ' is back. Williams +0.5.' });
      } else if (now > p.dueTq) {
        G[k] = null; if (G._eCut) G._eCut.restored = 'broken';
        remember('williams', -3, 'you broke ' + what);
        if (k === '_pledge') spendPC(1);
        out.push({ good: false, text: 'You broke ' + what + '. Williams −3' + (k === '_pledge' ? ', and 1 political capital' : '') + '.' });
      }
    });
    return out;
  }

  return { credit, canPledge, pledge, canTrust, trust, agenda, processQuarter, inCrisis };
})();
