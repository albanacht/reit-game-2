/* sim_harlow.js — what a player who LENDS to Harlow should expect at the
   loan's maturity, using story.js's own odds and tenants.js's cover dynamics
   (reversion 0.18, noise ±0.035) over 8 quarters in a stable economy.
   Run: node tools/sim_harlow.js                                              */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CENTRE = 1.55, N = 20000;
const shift = c => clamp((c - CENTRE) * 50, -25, 25);
let tot = { repay: 0, extend: 0, cant: 0 };
for (let i = 0; i < N; i++) {
  let c = 1.2 + Math.random() * 0.1 + 0.4, base = c;          // late-rent cover, then the loan's +0.4
  const drift = Math.random() < 0.6 ? 0 : -0.06;             // does the money help?
  for (let q = 0; q < 8; q++) { base += drift; c += (base - c) * 0.18 + (Math.random() * 2 - 1) * 0.035; }
  const s = shift(c), repay = clamp(30 + s, 5, 70), cant = clamp(35 - s, 5, 70);
  tot.repay += repay / N; tot.cant += cant / N; tot.extend += (100 - repay - cant) / N;
}
console.log('At maturity (stable economy): repay ' + tot.repay.toFixed(0) + '%, another year ' + tot.extend.toFixed(0) + '%, cannot pay ' + tot.cant.toFixed(0) + '%');
