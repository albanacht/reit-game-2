/* ============================================================================
   telemetry.js — HOW FAR DO PLAYERS GET? (round 23). window.Telemetry

   Anonymous counts through GoatCounter (albanacht.goatcounter.com): no
   accounts, no cookies, no names. Each event is a name you see on the
   GoatCounter dashboard, counted once per game:
     game-start, game-continue           a new game / a saved game reopened
     q1-played                           pressed Advance at least once
     reached-y2 … reached-y15            the funnel: where people stop
     ending-<kind>                       how runs end (fired, receivers, divine…)
     used-offer, used-land, used-build,  did they find the round 22 features?
     used-agent, used-campaign
     feedback-stars-<1..5>, feedback-stuck-<topic>, feedback-again-<yes|maybe|no>
   Free-text feedback goes to a form (FORM_URL) when there is one.

   Never breaks the game: if an ad blocker stops count.js, events are dropped.
   Nothing is sent from your own machine (a file opened from disk or
   localhost), so testing is not counted. It still counts inside a frame
   (itch.io).
   ========================================================================== */

window.Telemetry = (() => {

  const SITE = 'https://albanacht.goatcounter.com/count';   // the GoatCounter site code; if you rename it on GoatCounter, change it here too
  const SCRIPT = 'https://gc.zgo.at/count.js';
  const FORM_URL = 'https://docs.google.com/forms/d/1YIkXgphOrqXpwmALmeuoy19nicTmClY-k0HvoMd4JLo/viewform';   // written feedback (the player link, not /edit)
  const queue = [];

  /* Load count.js once (it also counts the page view). */
  function boot() {
    if (document.querySelector('script[data-goatcounter]')) return;
    // not from your own machine (a file opened from disk, or localhost): only the live site counts
    if (location.protocol === 'file:' || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)) return;
    const s = document.createElement('script');
    s.async = true; s.src = SCRIPT; s.setAttribute('data-goatcounter', SITE);
    s.setAttribute('data-goatcounter-settings', '{"allow_frame": true}');   // so it still counts if the game is embedded (itch.io)
    s.onload = flush;
    document.head.appendChild(s);
  }
  function flush() {
    if (!window.goatcounter || !window.goatcounter.count) return;
    while (queue.length) { const e = queue.shift(); try { window.goatcounter.count({ path: e, title: e, event: true }); } catch (x) {} }
  }
  /* Send an event now (or when count.js arrives). */
  function ev(name) {
    queue.push(String(name).replace(/[^a-z0-9-]/gi, '-').toLowerCase());
    flush();
  }
  /* Once per game: remembered in the save, so a reload does not count twice. */
  function once(name) {
    const G = window.GameState; if (!G) return;
    G._tele = G._tele || {};
    if (G._tele[name]) return;
    G._tele[name] = 1; ev(name);
  }

  /* -- hooks, called from the game ------------------------------------------- */
  function started() { if (window.GameState) GameState._tele = {}; once('game-start'); }
  function continued() { ev('game-continue'); }
  const MILES = [2, 3, 5, 8, 10, 13, 15];
  function quarter() {
    const G = window.GameState; if (!G) return;
    once('q1-played');
    MILES.forEach(y => { if (G.meta.year >= y) once('reached-y' + y); });
  }
  function ending(kind) { once('ending-' + kind); }
  const used = what => once('used-' + what);

  /* -- feedback: three taps, sent as counts; words go to the form ------------ */
  const STUCK = [['finance', 'Money: bonds, the credit line, shares'], ['board', 'The board and its demands'], ['buildings', 'Buying, selling, leasing'],
                 ['numbers', 'Too many numbers at once'], ['stories', 'The stories and decisions'], ['nothing', 'Nothing, it was clear']];
  function openFeedback() {
    if (!window.UI) return;
    const pick = { stars: 0, stuck: null, again: null };
    const btn = (group, val, label) => '<button class="fb-b" data-g="' + group + '" data-v="' + val + '">' + label + '</button>';
    UI.showModal('How was it?',
      '<div class="fb">' +
      '<div class="fb-q">Your rating</div><div class="fb-row">' + [1, 2, 3, 4, 5].map(n => btn('stars', n, '★'.repeat(n))).join('') + '</div>' +
      '<div class="fb-q">Where did you get stuck?</div><div class="fb-row">' + STUCK.map(s => btn('stuck', s[0], s[1])).join('') + '</div>' +
      '<div class="fb-q">Would you play again?</div><div class="fb-row">' + btn('again', 'yes', 'Yes') + btn('again', 'maybe', 'Maybe') + btn('again', 'no', 'No') + '</div>' +
      '<div class="sml-note">Anonymous: no names, no email. ' + (FORM_URL ? 'Want to say more? There is a short form for that.' : '') + '</div></div>',
      [{ label: 'Send', style: 'btn-primary', onClick: () => {
          if (pick.stars) ev('feedback-stars-' + pick.stars);
          if (pick.stuck) ev('feedback-stuck-' + pick.stuck);
          if (pick.again) ev('feedback-again-' + pick.again);
          if (UI.showToast) UI.showToast(pick.stars || pick.stuck || pick.again ? 'Thank you. It helps more than you think.' : 'Nothing picked, nothing sent.', 'success');
        } }].concat(FORM_URL ? [{ label: 'Write more (form)', onClick: () => window.open(FORM_URL, '_blank', 'noopener') }] : []));
    document.querySelectorAll('#modal-body .fb-b').forEach(b => b.onclick = () => {
      const g = b.dataset.g; pick[g] = g === 'stars' ? +b.dataset.v : b.dataset.v;
      document.querySelectorAll('#modal-body .fb-b[data-g="' + g + '"]').forEach(x => x.classList.toggle('on', x === b));
    });
  }

  try { boot(); } catch (e) {}
  return { ev, once, started, continued, quarter, ending, used, openFeedback, SITE, FORM_URL };
})();
