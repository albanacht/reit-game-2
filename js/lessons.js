/* ============================================================================
   lessons.js — round 43: Jenkins teaches the risks, the first time each one
   happens (Abe's playtest: "if something new happens, Jenkins helps").
   window.Lessons

   One short letter per lesson, once per game, with the player's own numbers.
   Off when the tutorial is off. Year 1 teaches the gap (ui.js); these teach
   what threatens it.
   ========================================================================== */

window.Lessons = (() => {

  const L = () => GameState._lessons || (GameState._lessons = { done: {}, base: null });
  const pct = n => (n * 100).toFixed(0) + '%';
  const tell = (key, title, body) => {
    const s = L(); if (s.done[key]) return false;
    s.done[key] = GameState.meta.year + '-' + GameState.meta.quarter;
    if (window.Inbox && Inbox.message) Inbox.message('Jenkins', 'Chief of Staff', title, body, 'assets/faces/jenkins.jpg');
    return true;
  };

  function processQuarter(out) {
    const G = GameState; if (!G || G._tutorialEnabled === false) return out;
    const s = L(), r = G.ratios || {}, y = G.meta.year, ph = window.Arc && Arc.phase ? Arc.phase() : '';
    let said = 0;   // never more than one lesson a quarter
    const once = (cond, key, title, body) => { if (!said && cond() && tell(key, title, body)) said++; };

    // the storm warning (and the crisis itself)
    once(() => ph === 'warning', 'warning', 'Storm warning, boss',
      'Banks are getting nervous; that’s how a crisis starts. Two things now, while money is still cheap:<br>1. <b>Refinance anything due in the next 3 years</b> into long bonds.<br>2. Keep cash and the credit line spare. In a crisis, cash is king.');
    once(() => ph === 'crisis', 'crisis', 'This is the crisis',
      'Tenants will fail, floors will empty, and our buildings are worth less this year. Survive first: keep the dividend paid from profit (Finance has an <b>emergency cut</b> the board approves), lease up empty space, and don’t let a bond fall due without the money. It ends. It always does.');
    // a bond falling due within a year
    const soon = (G.debtTranches || []).filter(t => G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 4);
    once(() => y >= 2 && soon.length > 0, 'bond', 'A bond falls due within a year',
      '$' + soon.reduce((a, t) => a + t.amount, 0).toFixed(0) + 'M of our bonds must be repaid within a year. Have the money ready, or <b>refinance before it falls due</b>: borrow new long bonds and use them to repay. Refinancing is cheap in calm times and expensive in a crisis.');
    // the dividend not covered
    const pr = window.Financials && Financials.payoutRatio ? Financials.payoutRatio() : null;
    once(() => y >= 2 && pr != null && pr > 1.0, 'cover', 'We paid more than we earned',
      'Last year’s dividend was <b>' + (pr != null ? pct(pr) : '') + ' of our cash profit</b>. Above 100% we are borrowing to pay shareholders. Do it for a while and the board, the lenders and the share price all notice. Grow the profit (fill space, buy well) or trim the dividend.');
    // rates up
    const base = (G.market || {}).baseInterestRate;
    once(() => s.base != null && base > s.base + 0.2, 'rates', 'Rates went up: what that means',
      'The base rate rose to <b>' + (base || 0).toFixed(2) + '%</b>. Two effects: new debt costs more, and <b>our buildings are worth less</b>, because buyers now want a higher yield for the same rent. The gap squeezes from both sides. Lock in long debt before it rises further.');
    s.base = base;
    // the shares cheap against the buildings
    const nav = r.navPerShare || 0, pn = nav > 0 ? G.company.sharePrice / nav : 1;
    once(() => y >= 2 && pn < 0.85, 'nav', 'Our shares are cheap',
      'The share price is <b>' + pct(pn) + ' of what our buildings are worth</b> (NAV). Selling new shares now would sell the company cheap: don’t. If we have spare cash, buying some back gets $1 of buildings for ' + (pn * 100).toFixed(0) + ' cents. Petrova will like it.');
    // a tenant goes bust
    once(() => (G._myDefaults || 0) > 0, 'default', 'A tenant went bust',
      'That’s why no single tenant should pay too much of our rent: more than about 15% and their trouble is our trouble. Properties shows who pays the rent and how healthy they are (rent cover below 1.0x: they pay us from savings).');
    // close to the covenant
    once(() => (r.debtToAssets || 0) > 0.55, 'covenant', 'Close to the debt limit',
      'Debt is <b>' + pct(r.debtToAssets || 0) + ' of assets</b>. Our bonds stop us at 60%, and if building values fall, we cross it without borrowing a dollar. Keep a buffer: pay some debt down, or issue shares if the price is near NAV.');
    return out;
  }

  return { processQuarter, L };
})();
