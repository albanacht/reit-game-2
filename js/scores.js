/* ============================================================================
   scores.js — THE 2.0 LEADERBOARD (round 28). window.Scores

   Ranked by YOUR OWN WEALTH at the end of the run (the game's score), with
   the company's total return per year beside it, the ending you reached and
   how many years you lasted. Any ending can post a score: you can lose the
   company and still win the board.

   Stored in one JSONBin bin, separate from v1's: { "scores": [ ... ] }.
   Set BIN and KEY below (an Access Key with Read + Update on that bin only).
   Until they are set the board says "opens soon" and nothing is sent.
   Read-modify-write: two players posting in the same second can lose one
   entry. Fine for a small circle; a server would be the fix if it ever grows.
   ========================================================================== */

window.Scores = (() => {

  const BIN = '6ad88dd6ac6210605a45383e';   // "SCORES 2.0", public to read
  const KEY = null;                          // the Access Key VALUE (starts with $2a$10$...), needed to post
  const MAX = 200, SHOW = 10;
  let testOn = false;                                   // tools/browser_round28.js: fetch stubbed
  const on = () => !!BIN || testOn;                     // the board can be read
  const canPost = () => !!(KEY && /^\$2[aby]\$/.test(KEY)) || testOn;
  const URL = () => 'https://api.jsonbin.io/v3/b/' + BIN;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const money = n => '$' + (+n || 0).toFixed(1) + 'M';
  const pctA = n => (n >= 0 ? '+' : '−') + Math.abs((n || 0) * 100).toFixed(1) + '%';
  let cache = null;

  async function fetchAll() {
    if (!on()) return [];
    try {
      const h = { 'X-Bin-Meta': 'false' }; if (canPost() && KEY) h['X-Access-Key'] = KEY;
      const r = await fetch(URL() + '/latest', { headers: h });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); cache = (d && (d.scores || (d.record && d.record.scores))) || []; return cache;
    } catch (e) { if (window.console) console.warn('scores', e); return cache || []; }
  }

  /* What this run posts. */
  function entry(name) {
    const G = GameState, f = window.Ending ? Ending.facts() : { wealth: 0, tsrA: 0, rivalsA: null };
    const k = window.Ending ? Ending.kind() : 'caretaker', T = window.Ending ? (Ending.ALL.find(a => a[0] === k) || [k, k])[1] : k;
    return { name: String(name || G.player.name || 'CEO').slice(0, 24), company: String(G.company.name || '').slice(0, 30),
             wealth: Math.round(f.wealth * 10) / 10, tsrA: Math.round((f.tsrA || 0) * 1000) / 1000,
             rivalsA: f.rivalsA == null ? null : Math.round(f.rivalsA * 1000) / 1000,
             ending: k, endingTitle: T, years: Math.min(15, G.meta.year), date: new Date().toISOString().slice(0, 10), v: 2 };
  }
  async function post(name) {
    if (!on() || !canPost()) return { success: false, message: 'Posting opens soon. The board is read only for now.' };
    if (GameState._scorePosted) return { success: false, message: 'This run is already on the board.' };
    try {
      const list = await fetchAll(), e = entry(name);
      const all = list.concat([e]).sort((a, b) => b.wealth - a.wealth).slice(0, MAX);
      const r = await fetch(URL(), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Access-Key': KEY }, body: JSON.stringify({ scores: all }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cache = all; GameState._scorePosted = true;
      const rank = all.indexOf(e) + 1;
      if (window.Telemetry) Telemetry.once('score-posted');
      return { success: true, rank, of: all.length, message: rank ? 'On the board: #' + rank + ' of ' + all.length + '.' : 'Posted. Not in the top ' + MAX + ' this time.' };
    } catch (err) { return { success: false, message: 'Could not reach the leaderboard. Check your connection.' }; }
  }

  function tableHTML(list, mine) {
    if (!list.length) return '<div class="lb2-empty">No scores yet. Be the first.</div>';
    return '<table class="lb2"><tr><th>#</th><th>CEO</th><th>Your wealth</th><th>Shareholders a year</th><th>Ending</th><th>Years</th></tr>' +
      list.slice(0, SHOW).map((e, i) => '<tr' + (mine && e.name === mine.name && e.date === mine.date && e.wealth === mine.wealth ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td><b>' + esc(e.name) + '</b><span>' + esc(e.company) + '</span></td><td class="w">' + money(e.wealth) + '</td><td>' + pctA(e.tsrA) +
        (e.rivalsA != null ? '<span>rivals ' + pctA(e.rivalsA) + '</span>' : '') + '</td><td>' + esc(e.endingTitle) + '</td><td>' + e.years + '</td></tr>').join('') + '</table>';
  }
  /* Title screen: a folded section. */
  async function renderTitle() {
    const box = document.getElementById('lb2-title'); if (!box) return;
    if (!on()) { box.innerHTML = '<details class="lb2-d"><summary>Leaderboard</summary><div class="lb2-empty">Opens soon: finish a run, and your wealth goes on the board.</div></details>'; return; }
    box.innerHTML = '<details class="lb2-d"><summary>Leaderboard: the richest CEOs</summary><div class="lb2-body">Loading…</div></details>';
    const list = await fetchAll(); const b = box.querySelector('.lb2-body'); if (b) b.innerHTML = tableHTML(list);
  }
  /* Game over screen: post, then see where you stand. */
  function renderGameOver() {
    const box = document.getElementById('lb2-gameover'); if (!box) return;
    if (!on()) { box.innerHTML = ''; return; }
    const e = entry();
    box.innerHTML = '<div class="lb2-post"><div>Your score: <b>' + money(e.wealth) + '</b> of your own · shareholders ' + pctA(e.tsrA) + ' a year · ' + esc(e.endingTitle) + '</div>' +
      (!canPost() ? '<div class="lb2-msg">Posting scores opens soon.</div>' : GameState._scorePosted ? '<div class="lb2-msg">Already on the board.</div>' :
       '<div class="lb2-row"><input id="lb2-name" maxlength="24" value="' + esc(GameState.player.name || '') + '" placeholder="Your name"><button id="lb2-go" class="btn btn-primary">Post to the leaderboard</button></div>') +
      '<div class="lb2-msg" id="lb2-msg"></div><div id="lb2-table"></div></div>';
    const go = document.getElementById('lb2-go');
    if (go) go.onclick = async () => { go.disabled = true; const r = await post((document.getElementById('lb2-name') || {}).value);
      document.getElementById('lb2-msg').textContent = r.message; document.getElementById('lb2-table').innerHTML = tableHTML(cache || [], r.success ? e : null); if (!r.success) go.disabled = false; };
    fetchAll().then(list => { const t = document.getElementById('lb2-table'); if (t && !t.innerHTML) t.innerHTML = tableHTML(list); });
  }

  return { on, test: v => { testOn = !!v; }, fetchAll, post, entry, tableHTML, renderTitle, renderGameOver };
})();
