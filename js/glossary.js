/* ============================================================================
   glossary.js — plain-English explanations on hover (design doc B.12h).

   Player feedback on v1: "Without prior financial knowledge and all the terms
   and acronyms I have no chance." Every label that names a financial idea
   gets a dotted underline; hovering shows one line a non-finance player
   understands. Labels are matched by their text, so new screens pick this up
   by calling Glossary.tag() after they render.
   ========================================================================== */

window.Glossary = (() => {

  const T = {
    // top bar
    'cash': 'Money in the bank right now. Below zero you are on an expensive overdraft.',
    'retained last qtr': 'What was left last quarter after rent, costs, interest and dividends. Below zero means you burned cash.',
    'share price': 'What one share sells for. It follows your dividend, your asset value and how risky you look.',
    'debt assets': 'How much of everything you own is paid for with borrowed money. Above about 50% lenders and investors get nervous.',
    'situation': 'A two-word read of where the company stands, from Crisis to Room to move.',

    // income statement
    'gross potential rent': 'All the rent you would collect if every building were full.',
    'vacancy loss': 'Rent you miss because space is empty.',
    'operating expenses': 'Running the buildings: maintenance, utilities, insurance, property tax.',
    'net operating income': 'NOI: rent after the buildings’ running costs. What the properties earn before head office and interest.',
    'noi': 'Net operating income: rent after the buildings’ running costs.',
    'ann noi': 'Net operating income per year: rent after the building’s running costs.',
    'ga expense': 'Head office: salaries, lawyers, accountants, the CEO’s office.',
    'interest expense': 'What your loans cost this quarter.',
    'depreciation': 'An accounting charge for buildings wearing out. Not real cash, so REITs add it back.',
    'unusual items': 'One-off costs or gains: repairs, fines, settlements.',
    'net income gaap': 'The official accounting profit. For a REIT it understates cash, because of depreciation.',
    'ffo': 'Funds from operations: net income with depreciation added back. The REIT’s real profit.',
    'affo': 'Adjusted FFO: FFO minus the upkeep spending needed to keep buildings competitive. The closest thing to free cash.',
    'preferred dividends': 'Fixed payments to preferred shareholders. They get paid before ordinary shareholders.',
    'dividends paid': 'Cash paid to your shareholders this quarter.',
    'retained cash': 'What is left after everything, including dividends. This is what grows (or shrinks) your bank balance.',

    // ratios
    'ffoshare': 'FFO divided by the number of shares: your profit per share each quarter.',
    'affoshare': 'Cash profit per share each quarter. Grow this and the share price follows.',
    'div coverage': 'Cash profit ÷ dividends. Below 1.0x you are paying out more than you earn.',
    'payout ratio': 'Share of cash profit paid out as dividends. REITs usually pay 70–90%.',
    'debtebitda': 'Years of profit it would take to repay all debt. Above about 7x looks stretched.',
    'int coverage': 'Profit ÷ interest. Below about 2x lenders start to worry.',
    'occupancy': 'Share of space that is let to paying tenants.',
    'noi margin': 'How much of gross rent survives as NOI after running costs.',
    'cap rate': 'Yearly rent after costs ÷ building value. Higher means a cheaper building, usually a riskier one.',
    'navshare': 'Net asset value per share: buildings plus cash, minus debt, split across shares.',
    'pffo': 'Share price ÷ yearly FFO per share: how many years of profit investors pay for.',
    'paffo': 'Share price ÷ yearly cash profit per share. Lower means cheaper.',
    'div yield': 'Yearly dividend ÷ share price. What shareholders earn in cash each year.',

    // balance sheet
    'total assets': 'Everything you own: buildings at today’s value, plus cash.',
    'total debt': 'Everything you owe to lenders.',
    'preferred equity': 'Money from preferred shareholders: like debt, but no fixed repayment date.',
    'common equity': 'What belongs to ordinary shareholders: assets minus debt and preferred.',
    'shares out': 'How many shares exist. Issuing more spreads the profit thinner.',
    'divshare q': 'Dividend per share paid each quarter.',

    // capital actions
    'borrow': 'Take a loan. Cheap money grows you; too much makes every shock dangerous.',
    'issue shares': 'Sell new shares for cash. No interest, but every existing share now owns a smaller slice.',
    'buy back shares': 'Spend cash buying your own shares. Fewer shares, so each owns more profit.',
    'dividend': 'Cash you pay shareholders every quarter. The board watches it closely; cutting it hurts.',

    // credit line (revolver.js)
    'line': 'The most the bank will lend you on the revolving credit facility.',
    'drawn': 'How much of the credit line you are using. It shows as cash below zero.',
    'available': 'How much more you can draw before you hit the limit.',
    'rate on what you draw': 'Floating: it moves with interest rates and your credit rating.',
    'fee on the unused line': 'Banks charge a small fee for keeping money ready for you.',
    'next review': 'Every 3 years the bank renews the line. If your numbers got worse, it sets tougher terms.',

    // properties and map
    'est value': 'What the building would sell for today.',
    'value': 'What the building would sell for today.',
    'tenants': 'Who rents the space. A single tenant means all or nothing.',
    'yoc': 'Yield on cost: yearly rent after costs ÷ what you paid.',
    'noi yr': 'Net operating income per year: rent after the building\u2019s running costs.',
    'cap yoc': 'Cap rate: yearly rent after costs \u00f7 today\u2019s value. YoC (yield on cost): the same \u00f7 what you paid.',
    'asking': 'The price the seller wants.',
    'listed': 'How long the building has been for sale.',

    // deal preview
    'rent you collect': 'Yearly rent after the building’s running costs (NOI).',
    'rent you lose': 'Yearly rent after running costs that goes with the building.',
    'cash profit per share': 'Change in AFFO per share each quarter: the number the market cares about most.',
    'yield on price': 'What the building earns each year ÷ what you pay for it (its cap rate).',
    'if you borrowed for it': 'Your interest rate today on a 5-year loan.',
    'spread': 'Building yield minus borrowing cost. Positive: debt-funded, it pays for itself.',
    'gain vs what you paid': 'Sale price after fees minus what you paid for the building.',
  };

  const norm = s => String(s || '').toLowerCase().replace(/&amp;/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const KEY = {};
  Object.keys(T).forEach(k => { KEY[norm(k)] = T[k]; KEY[norm(k).replace(/ /g, '')] = T[k]; });
  const lookup = txt => KEY[norm(txt)] || KEY[norm(txt).replace(/ /g, '')] || null;

  // where labels live
  const SELECTORS = [
    '#tb-hud .k', '.pnl-table td:first-child', '.ratio-label', '.bs-label', '.action-group-title',
    '#tab-properties th', '#card .k', '.dp td:first-child', '.rcf-r span'
  ];

  function tag(root) {
    (root || document).querySelectorAll(SELECTORS.join(',')).forEach(el => {
      if (el.dataset.tip) return;
      // the label's own words, not trailing notes ("Borrow to buy property" -> "Borrow")
      const own = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.textContent : el.textContent;
      const t = lookup(own) || lookup(el.textContent);
      if (t) { el.dataset.tip = t; el.classList.add('has-tip'); }
    });
  }

  // one floating tooltip for the whole page (never clipped by panels)
  let box = null;
  function show(el, x, y) {
    if (!box) { box = document.createElement('div'); box.id = 'tipbox'; document.body.appendChild(box); }
    box.textContent = el.dataset.tip;
    box.style.display = 'block';
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.min(window.innerWidth - w - 8, x + 12) + 'px';
    box.style.top = (y + h + 24 > window.innerHeight ? y - h - 10 : y + 16) + 'px';
  }
  const hide = () => { if (box) box.style.display = 'none'; };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el) show(el, e.clientX, e.clientY); else hide();
  });
  document.addEventListener('scroll', hide, true);

  // tag whatever gets drawn: tables re-render, dialogs open, map cards appear
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; tag(document); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  return { tag, lookup, TERMS: T };
})();
