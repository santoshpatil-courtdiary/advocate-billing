/* ============================================================
   app.js — Advocate billing: clients, quotations, invoices,
   receipts, ledgers. Records are held by js/cloud.js, either in the
   Firebase project (signed in) or in this browser (offline mode).
   ============================================================ */
(function () {
  'use strict';


  /* ---------------- defaults ---------------- */
  var DEFAULT_SETTINGS = {
    name: 'SANTOSH KESHAV PATIL',
    qual: 'B.S.L., LL.M.',
    designation: 'ADVOCATE',
    addr1: 'B 702, Amit Astonia Royale, Narhe Ambegaon Road,',
    addr2: 'Bhumkarnagar, Ambegaon Bk, Pune 411 046',
    phone: '9922416161',
    email: '',
    pan: 'BHJPP4742H',
    enrol: 'Mah/1683/2006',
    chequeNote: 'All cheques to be drawn in favour of SANTOSH KESHAV PATIL only.',
    bankName: '', bankAcct: '', bankIfsc: '', bankUpi: '',
    prefixQ: 'QTN', prefixI: 'INV', prefixR: 'RCT',
    fyNumbering: true,
    showSign: true, showSeal: false, showLetterhead: true,
    paper: 'A5', currency: '₹',
    quoteTerms:
      '1. This quotation is valid for 30 days from the date hereof.\n' +
      '2. Court fees, stamp duty, registration charges, travelling and other out of pocket expenses are payable at actuals and are not included unless separately stated.\n' +
      '3. Professional fees are payable as per the schedule stated above.\n' +
      '4. This quotation covers only the work expressly described herein.',
    invoiceTerms:
      '1. Payment is due within seven days from the receipt of this bill.\n' +
      '2. Out of pocket expenses, court fees and stamp duty, if any, are charged at actuals.\n' +
      '3. Kindly quote the bill number while making payment.'
  };

  var DB = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    clients: [], quotes: [], invoices: [], receipts: [], adjustments: []
  };

  /* ---------------- storage ----------------
     Every change goes through Store (js/cloud.js), which writes to
     Firestore when the office is signed in, and to this browser when
     it is not. DB stays the in-memory copy that the screens read.   */

  function adoptLocal(d) {
    if (!d) return;
    DB.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
    ['clients', 'quotes', 'invoices', 'receipts', 'adjustments'].forEach(function (k) {
      DB[k] = Array.isArray(d[k]) ? d[k] : [];
    });
  }

  function storeFailed() { toast('Could not save — storage is full or blocked'); }

  /** insert or replace one record in a collection */
  function upsert(coll, rec) {
    var arr = DB[coll], i = -1, n;
    for (n = 0; n < arr.length; n++) if (arr[n].id === rec.id) { i = n; break; }
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    if (Store.put(coll, rec, DB) === false) storeFailed();
  }

  /** drop one record from a collection */
  function dropRec(coll, id) {
    DB[coll] = DB[coll].filter(function (x) { return x.id !== id; });
    if (Store.remove(coll, id, DB) === false) storeFailed();
  }

  function persistSettings() {
    if (Store.saveSettings(DB.settings, DB) === false) storeFailed();
  }

  /* ---------------- small utils ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  var INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return INR.format(r2(num(n))); }
  function rs(n) { return DB.settings.currency + ' ' + money(n); }

  function todayISO() {
    var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function fyOf(iso) {
    if (!iso) iso = todayISO();
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    var s = (m >= 4) ? y : y - 1;
    return s + '-' + String((s + 1) % 100).padStart(2, '0');
  }
  function fyRange(fy) {
    var s = +fy.split('-')[0];
    return { from: s + '-04-01', to: (s + 1) + '-03-31' };
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }

  /* ---------------- amount in words (Indian system) ---------------- */
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function two(n) {
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  }
  function three(n) {
    var h = Math.floor(n / 100), r = n % 100, out = '';
    if (h) out += ONES[h] + ' Hundred';
    if (r) out += (h ? ' ' : '') + two(r);
    return out;
  }
  function inWords(amount) {
    var n = Math.floor(Math.abs(r2(amount)));
    var paise = Math.round((Math.abs(r2(amount)) - n) * 100);
    if (n === 0 && !paise) return 'Rupees Nil only';
    var parts = [];
    var crore = Math.floor(n / 10000000); n %= 10000000;
    var lakh = Math.floor(n / 100000); n %= 100000;
    var thou = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push(three(crore) + ' Crore');
    if (lakh) parts.push(three(lakh) + ' Lakh');
    if (thou) parts.push(three(thou) + ' Thousand');
    if (n) parts.push(three(n));
    var s = 'Rupees ' + (parts.join(' ') || 'Nil');
    if (paise) s += ' and ' + two(paise) + ' Paise';
    return s + ' only';
  }

  /* ---------------- lookups & computations ---------------- */
  function client(id) { return DB.clients.find(function (c) { return c.id === id; }) || null; }
  function clientName(id) { var c = client(id); return c ? c.name : '(client deleted)'; }

  function docTotals(doc) {
    var fees = 0, exp = 0;
    (doc.items || []).forEach(function (it) {
      var amt = r2(num(it.qty) * num(it.rate));
      if (it.kind === 'expense') exp += amt; else fees += amt;
    });
    var sub = r2(fees + exp);
    var disc = r2(num(doc.discount));
    var total = r2(sub - disc);
    return { fees: r2(fees), expenses: r2(exp), sub: sub, discount: disc, total: total };
  }
  function paidOn(invoiceId) {
    return r2(DB.receipts.filter(function (r) { return r.invoiceId === invoiceId; })
      .reduce(function (a, r) { return a + num(r.amount); }, 0));
  }
  function invoiceStatus(inv) {
    if (inv.cancelled) return { key: 'draft', label: 'Cancelled' };
    var t = docTotals(inv).total, p = paidOn(inv.id);
    if (p <= 0) return { key: 'due', label: 'Unpaid' };
    if (p + 0.01 < t) return { key: 'part', label: 'Part paid' };
    return { key: 'paid', label: 'Paid' };
  }

  function ledgerRows(clientId, from, to) {
    var c = client(clientId);
    if (!c) return { opening: 0, rows: [], closing: 0 };
    var rows = [];
    if (num(c.opening)) {
      rows.push({
        date: c.openingDate || '1900-01-01', sort: 0,
        particulars: 'Opening balance', ref: '',
        debit: num(c.opening) > 0 ? num(c.opening) : 0,
        credit: num(c.opening) < 0 ? -num(c.opening) : 0,
        opening: true
      });
    }
    DB.invoices.filter(function (i) { return i.clientId === clientId && !i.cancelled; }).forEach(function (i) {
      rows.push({
        date: i.date, sort: 1, particulars: 'Bill' + (i.subject ? ' — ' + i.subject : ''),
        ref: i.no, debit: docTotals(i).total, credit: 0, type: 'invoice', id: i.id
      });
    });
    DB.receipts.filter(function (r) { return r.clientId === clientId; }).forEach(function (r) {
      var against = r.invoiceId ? (DB.invoices.find(function (i) { return i.id === r.invoiceId; }) || {}).no : '';
      rows.push({
        date: r.date, sort: 2,
        particulars: 'Receipt' + (r.mode ? ' by ' + r.mode : '') + (against ? ' against ' + against : ' on account') +
          (r.ref ? ' (' + r.ref + ')' : ''),
        ref: r.no, debit: 0, credit: num(r.amount), type: 'receipt', id: r.id
      });
    });
    DB.adjustments.filter(function (a) { return a.clientId === clientId; }).forEach(function (a) {
      rows.push({
        date: a.date, sort: 3, particulars: a.narration || 'Adjustment', ref: a.ref || '',
        debit: num(a.debit), credit: num(a.credit), type: 'adjustment', id: a.id
      });
    });

    rows.sort(function (a, b) {
      if (a.opening) return -1; if (b.opening) return 1;
      return a.date === b.date ? a.sort - b.sort : (a.date < b.date ? -1 : 1);
    });

    var openingBal = 0, out = [], bal = 0;
    rows.forEach(function (r) {
      var before = from && !r.opening && r.date < from;
      if (before || r.opening) { openingBal += r.debit - r.credit; return; }
      if (to && r.date > to) return;
      out.push(r);
    });
    bal = openingBal;
    out.forEach(function (r) { bal += r.debit - r.credit; r.balance = r2(bal); });
    return { opening: r2(openingBal), rows: out, closing: r2(bal) };
  }

  function clientBalance(id) {
    var l = ledgerRows(id, '', '');
    return l.closing;
  }

  function nextNo(kind, dateISO) {
    var S = DB.settings;
    var prefix = kind === 'Q' ? S.prefixQ : kind === 'I' ? S.prefixI : S.prefixR;
    var list = kind === 'Q' ? DB.quotes : kind === 'I' ? DB.invoices : DB.receipts;
    var fy = fyOf(dateISO);
    var head = prefix + '/' + (S.fyNumbering ? fy + '/' : '');
    var max = 0;
    list.forEach(function (d) {
      if (!d.no) return;
      if (d.no.indexOf(head) !== 0) return;
      var m = d.no.slice(head.length).match(/^(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return head + String(max + 1).padStart(3, '0');
  }

  /* ============================================================
     VIEWS
     ============================================================ */
  var current = 'dashboard';

  function switchTab(tab) {
    current = tab;
    $$('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    $('#view-' + tab).classList.remove('hidden');
    render();
  }

  function render() {
    if (current === 'dashboard') renderDashboard();
    if (current === 'clients') renderClients();
    if (current === 'quotations') renderQuotes();
    if (current === 'invoices') renderInvoices();
    if (current === 'receipts') renderReceipts();
    if (current === 'ledger') renderLedger();
    if (current === 'settings') fillSettings();
    $('#brandName').textContent = DB.settings.name.replace(/\b\w+/g, function (w) {
      return w[0] + w.slice(1).toLowerCase();
    });
  }

  function emptyRow(msg) { return '<div class="empty">' + esc(msg) + '</div>'; }

  /* ---------- dashboard ---------- */
  function allFYs() {
    var set = {};
    DB.invoices.concat(DB.receipts, DB.quotes).forEach(function (d) { if (d.date) set[fyOf(d.date)] = 1; });
    set[fyOf(todayISO())] = 1;
    return Object.keys(set).sort().reverse();
  }

  function renderDashboard() {
    var sel = $('#dashFY'), cur = sel.value || fyOf(todayISO());
    sel.innerHTML = '<option value="ALL">All years</option>' +
      allFYs().map(function (f) { return '<option value="' + f + '">FY ' + f + '</option>'; }).join('');
    sel.value = cur;
    if (!sel.value) sel.value = fyOf(todayISO());
    var fy = sel.value, rng = fy === 'ALL' ? null : fyRange(fy);
    var inRange = function (d) { return !rng || (d.date >= rng.from && d.date <= rng.to); };

    var billed = DB.invoices.filter(function (i) { return !i.cancelled && inRange(i); })
      .reduce(function (a, i) { return a + docTotals(i).total; }, 0);
    var received = DB.receipts.filter(inRange).reduce(function (a, r) { return a + num(r.amount); }, 0);
    var outstanding = DB.clients.reduce(function (a, c) { var b = clientBalance(c.id); return a + (b > 0 ? b : 0); }, 0);
    var quoted = DB.quotes.filter(inRange).reduce(function (a, q) { return a + docTotals(q).total; }, 0);

    $('#statGrid').innerHTML = [
      ['Billed', rs(billed), ''],
      ['Received', rs(received), 'ok'],
      ['Outstanding (all years)', rs(outstanding), outstanding > 0 ? 'due' : ''],
      ['Quoted', rs(quoted), '']
    ].map(function (s) {
      return '<div class="stat"><div class="k">' + s[0] + '</div><div class="v ' + s[2] + '">' + s[1] + '</div></div>';
    }).join('');

    var dues = DB.clients.map(function (c) { return { c: c, b: clientBalance(c.id) }; })
      .filter(function (x) { return Math.abs(x.b) > 0.009; })
      .sort(function (a, b) { return b.b - a.b; });
    $('#dashOutstanding').innerHTML = dues.length ? '<table class="grid"><thead><tr><th>Client</th><th class="num">Balance</th><th></th></tr></thead><tbody>' +
      dues.map(function (x) {
        return '<tr><td>' + esc(x.c.name) + '</td><td class="num"' + (x.b < 0 ? ' style="color:#0f7b3f"' : '') + '>' +
          rs(Math.abs(x.b)) + (x.b < 0 ? ' Cr' : '') + '</td>' +
          '<td class="actions"><button class="btn sm" data-goledger="' + x.c.id + '">Ledger</button></td></tr>';
      }).join('') + '</tbody></table>' : emptyRow('Nothing outstanding');

    var recent = DB.invoices.map(function (d) { return { t: 'Bill', d: d, date: d.date, no: d.no, amt: docTotals(d).total, who: clientName(d.clientId) }; })
      .concat(DB.receipts.map(function (d) { return { t: 'Receipt', d: d, date: d.date, no: d.no, amt: num(d.amount), who: clientName(d.clientId) }; }))
      .concat(DB.quotes.map(function (d) { return { t: 'Quotation', d: d, date: d.date, no: d.no, amt: docTotals(d).total, who: clientName(d.clientId) }; }))
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10);

    $('#dashRecent').innerHTML = recent.length ? '<table class="grid"><tbody>' + recent.map(function (x) {
      return '<tr><td style="width:84px"><span class="sub">' + fmtDate(x.date) + '</span></td>' +
        '<td>' + x.t + ' <span class="sub">' + esc(x.no || '') + '</span><div class="sub">' + esc(x.who) + '</div></td>' +
        '<td class="num">' + rs(x.amt) + '</td></tr>';
    }).join('') + '</tbody></table>' : emptyRow('No documents yet');
  }

  /* ---------- clients ---------- */
  function renderClients() {
    var q = ($('#clientSearch').value || '').toLowerCase();
    var list = DB.clients.filter(function (c) {
      return !q || (c.name + ' ' + (c.phone || '') + ' ' + (c.addr || '') + ' ' + (c.notes || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    if (!list.length) { $('#clientList').innerHTML = emptyRow(DB.clients.length ? 'No match' : 'No clients yet. Add your first client.'); return; }

    $('#clientList').innerHTML = '<table class="grid"><thead><tr>' +
      '<th>Client</th><th>Phone</th><th class="num">Billed</th><th class="num">Received</th><th class="num">Balance</th><th></th>' +
      '</tr></thead><tbody>' + list.map(function (c) {
        var billed = DB.invoices.filter(function (i) { return i.clientId === c.id && !i.cancelled; })
          .reduce(function (a, i) { return a + docTotals(i).total; }, 0);
        var recd = DB.receipts.filter(function (r) { return r.clientId === c.id; })
          .reduce(function (a, r) { return a + num(r.amount); }, 0);
        var bal = clientBalance(c.id);
        return '<tr><td><b>' + esc(c.name) + '</b>' + (c.addr ? '<div class="sub">' + esc(c.addr.split('\n')[0]) + '</div>' : '') + '</td>' +
          '<td class="sub">' + esc(c.phone || '') + '</td>' +
          '<td class="num">' + money(billed) + '</td><td class="num">' + money(recd) + '</td>' +
          '<td class="num"' + (bal > 0.009 ? ' style="color:#b3261e;font-weight:600"' : (bal < -0.009 ? ' style="color:#0f7b3f"' : '')) + '>' +
          money(Math.abs(bal)) + (bal < -0.009 ? ' Cr' : '') + '</td>' +
          '<td class="actions">' +
          '<button class="btn sm" data-goledger="' + c.id + '">Ledger</button>' +
          '<button class="btn sm" data-editclient="' + c.id + '">Edit</button>' +
          '<button class="btn sm danger ghost" data-delclient="' + c.id + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- lists for documents ---------- */
  function renderQuotes() {
    var q = ($('#quoteSearch').value || '').toLowerCase();
    var list = DB.quotes.filter(function (d) {
      return !q || ((d.no || '') + ' ' + clientName(d.clientId) + ' ' + (d.subject || '') + ' ' + (d.matter || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!list.length) { $('#quoteList').innerHTML = emptyRow(DB.quotes.length ? 'No match' : 'No quotations yet.'); return; }

    $('#quoteList').innerHTML = '<table class="grid"><thead><tr><th>No.</th><th>Date</th><th>Client / Subject</th>' +
      '<th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (d) {
        var st = d.status || 'Draft';
        var cls = st === 'Accepted' ? 'paid' : st === 'Converted' ? 'paid' : st === 'Declined' ? 'due' : st === 'Sent' ? 'part' : 'draft';
        return '<tr><td class="mono">' + esc(d.no) + '</td><td class="sub">' + fmtDate(d.date) + '</td>' +
          '<td><b>' + esc(clientName(d.clientId)) + '</b>' + (d.subject ? '<div class="sub">' + esc(d.subject) + '</div>' : '') + '</td>' +
          '<td class="num">' + money(docTotals(d).total) + '</td>' +
          '<td><span class="pill ' + cls + '">' + esc(st) + '</span></td>' +
          '<td class="actions">' +
          '<button class="btn sm" data-viewq="' + d.id + '">View</button>' +
          '<button class="btn sm" data-editq="' + d.id + '">Edit</button>' +
          '<button class="btn sm" data-conv="' + d.id + '">To bill</button>' +
          '<button class="btn sm danger ghost" data-delq="' + d.id + '">Del</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderInvoices() {
    var q = ($('#invoiceSearch').value || '').toLowerCase();
    var list = DB.invoices.filter(function (d) {
      return !q || ((d.no || '') + ' ' + clientName(d.clientId) + ' ' + (d.subject || '') + ' ' + (d.matter || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!list.length) { $('#invoiceList').innerHTML = emptyRow(DB.invoices.length ? 'No match' : 'No invoices yet.'); return; }

    $('#invoiceList').innerHTML = '<table class="grid"><thead><tr><th>No.</th><th>Date</th><th>Client / Subject</th>' +
      '<th class="num">Amount</th><th class="num">Received</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (d) {
        var t = docTotals(d).total, p = paidOn(d.id), st = invoiceStatus(d);
        return '<tr><td class="mono">' + esc(d.no) + '</td><td class="sub">' + fmtDate(d.date) + '</td>' +
          '<td><b>' + esc(clientName(d.clientId)) + '</b>' + (d.subject ? '<div class="sub">' + esc(d.subject) + '</div>' : '') + '</td>' +
          '<td class="num">' + money(t) + '</td><td class="num">' + money(p) + '</td>' +
          '<td class="num">' + money(t - p) + '</td>' +
          '<td><span class="pill ' + st.key + '">' + st.label + '</span></td>' +
          '<td class="actions">' +
          '<button class="btn sm" data-viewi="' + d.id + '">View</button>' +
          '<button class="btn sm" data-editi="' + d.id + '">Edit</button>' +
          '<button class="btn sm" data-recpt="' + d.id + '">Receipt</button>' +
          '<button class="btn sm danger ghost" data-deli="' + d.id + '">Del</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderReceipts() {
    var q = ($('#receiptSearch').value || '').toLowerCase();
    var list = DB.receipts.filter(function (d) {
      return !q || ((d.no || '') + ' ' + clientName(d.clientId) + ' ' + (d.ref || '') + ' ' + (d.mode || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!list.length) { $('#receiptList').innerHTML = emptyRow(DB.receipts.length ? 'No match' : 'No receipts yet.'); return; }

    $('#receiptList').innerHTML = '<table class="grid"><thead><tr><th>No.</th><th>Date</th><th>Client</th>' +
      '<th>Mode / Reference</th><th>Against</th><th class="num">Amount</th><th></th></tr></thead><tbody>' +
      list.map(function (d) {
        var inv = DB.invoices.find(function (i) { return i.id === d.invoiceId; });
        return '<tr><td class="mono">' + esc(d.no) + '</td><td class="sub">' + fmtDate(d.date) + '</td>' +
          '<td><b>' + esc(clientName(d.clientId)) + '</b></td>' +
          '<td class="sub">' + esc(d.mode || '') + (d.ref ? ' &middot; ' + esc(d.ref) : '') + '</td>' +
          '<td class="sub">' + (inv ? esc(inv.no) : 'On account') + '</td>' +
          '<td class="num">' + money(d.amount) + '</td>' +
          '<td class="actions">' +
          '<button class="btn sm" data-viewr="' + d.id + '">View</button>' +
          '<button class="btn sm" data-editr="' + d.id + '">Edit</button>' +
          '<button class="btn sm danger ghost" data-delr="' + d.id + '">Del</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- ledger ---------- */
  function renderLedger() {
    var sel = $('#ledgerClient'), keep = sel.value;
    sel.innerHTML = '<option value="">Select client</option>' + DB.clients.slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
    if (keep) sel.value = keep;

    var id = sel.value;
    if (!id) { $('#ledgerPanel').innerHTML = emptyRow('Choose a client to see the ledger'); return; }

    var from = $('#ledgerFrom').value, to = $('#ledgerTo').value;
    var L = ledgerRows(id, from, to);
    var c = client(id);

    var head = '<div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap">' +
      '<div><b>' + esc(c.name) + '</b>' + (c.phone ? '<span class="sub"> &middot; ' + esc(c.phone) + '</span>' : '') + '</div>' +
      '<div class="row-right">' +
      '<button class="btn sm" id="btnLedgerView">Statement</button>' +
      '<button class="btn sm" id="btnLedgerCsv">CSV</button></div></div>';

    var rows = L.rows.map(function (r) {
      return '<tr><td class="sub" style="width:80px">' + fmtDate(r.date) + '</td>' +
        '<td>' + esc(r.particulars) + '</td>' +
        '<td class="mono sub" style="width:110px">' + esc(r.ref || '') + '</td>' +
        '<td class="num">' + (r.debit ? money(r.debit) : '') + '</td>' +
        '<td class="num">' + (r.credit ? money(r.credit) : '') + '</td>' +
        '<td class="num"><b>' + money(Math.abs(r.balance)) + '</b> <span class="sub">' + (r.balance < 0 ? 'Cr' : 'Dr') + '</span></td>' +
        '<td class="actions">' + (r.type === 'adjustment' ? '<button class="btn sm danger ghost" data-deladj="' + r.id + '">Del</button>' : '') + '</td></tr>';
    }).join('');

    $('#ledgerPanel').innerHTML = head + '<table class="grid"><thead><tr>' +
      '<th>Date</th><th>Particulars</th><th>Voucher</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th><th></th>' +
      '</tr></thead><tbody>' +
      '<tr><td class="sub">' + (from ? fmtDate(from) : '') + '</td><td><i>Opening balance</i></td><td></td>' +
      '<td class="num">' + (L.opening > 0 ? money(L.opening) : '') + '</td>' +
      '<td class="num">' + (L.opening < 0 ? money(-L.opening) : '') + '</td>' +
      '<td class="num"><b>' + money(Math.abs(L.opening)) + '</b> <span class="sub">' + (L.opening < 0 ? 'Cr' : 'Dr') + '</span></td><td></td></tr>' +
      rows +
      '<tr style="background:#fafbfd"><td></td><td><b>Closing balance</b></td><td></td><td></td><td></td>' +
      '<td class="num"><b>' + money(Math.abs(L.closing)) + '</b> <span class="sub">' + (L.closing < 0 ? 'Cr' : 'Dr') + '</span></td><td></td></tr>' +
      '</tbody></table>';

    $('#btnLedgerView').onclick = function () { previewLedger(id, from, to); };
    $('#btnLedgerCsv').onclick = function () { exportLedgerCsv(id, from, to); };
  }

  function exportLedgerCsv(id, from, to) {
    var L = ledgerRows(id, from, to), c = client(id);
    var lines = [['Date', 'Particulars', 'Voucher', 'Debit', 'Credit', 'Balance']];
    lines.push(['', 'Opening balance', '', L.opening > 0 ? L.opening : '', L.opening < 0 ? -L.opening : '', L.opening]);
    L.rows.forEach(function (r) { lines.push([fmtDate(r.date), r.particulars, r.ref || '', r.debit || '', r.credit || '', r.balance]); });
    lines.push(['', 'Closing balance', '', '', '', L.closing]);
    var csv = lines.map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    DocxKit.saveBlob(new Blob([csv], { type: 'text/csv' }), 'Ledger ' + c.name + '.csv');
  }

  /* ============================================================
     DRAWER EDITORS
     ============================================================ */
  var draft = null, draftKind = null;

  function openDrawer(title, bodyHTML, footHTML) {
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = bodyHTML;
    $('#drawerFoot').innerHTML = footHTML;
    $('#drawer').classList.remove('hidden');
  }
  function closeDrawer() { $('#drawer').classList.add('hidden'); draft = null; draftKind = null; }

  function clientOptions(sel) {
    return '<option value="">— select client —</option>' + DB.clients.slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
  }

  /* ---------- client editor ---------- */
  function editClient(id) {
    var c = id ? client(id) : { id: '', name: '', addr: '', phone: '', email: '', pan: '', opening: 0, openingDate: todayISO(), notes: '' };
    openDrawer(id ? 'Edit client' : 'New client',
      '<form id="clientForm" class="fields">' +
      '<label class="c4">Name of client<input name="name" value="' + esc(c.name) + '" required></label>' +
      '<label class="c4">Address<textarea name="addr" rows="3">' + esc(c.addr) + '</textarea></label>' +
      '<label class="c2">Phone<input name="phone" value="' + esc(c.phone) + '"></label>' +
      '<label class="c2">Email<input name="email" value="' + esc(c.email) + '"></label>' +
      '<label class="c2">PAN / GSTIN<input name="pan" value="' + esc(c.pan || '') + '"></label>' +
      '<label class="c2">Opening balance (Dr +, Cr −)<input name="opening" type="number" step="0.01" value="' + num(c.opening) + '"></label>' +
      '<label class="c2">Opening balance date<input name="openingDate" type="date" value="' + esc(c.openingDate || todayISO()) + '"></label>' +
      '<label class="c4">Notes<textarea name="notes" rows="2">' + esc(c.notes || '') + '</textarea></label>' +
      '</form>',
      '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveClient">Save client</button>');

    $('#saveClient').onclick = function () {
      var E = $('#clientForm').elements;
      if (!E.name.value.trim()) { toast('Client name is required'); return; }
      var rec = {
        id: c.id || uid(), name: E.name.value.trim(), addr: E.addr.value.trim(),
        phone: E.phone.value.trim(), email: E.email.value.trim(), pan: E.pan.value.trim(),
        opening: num(E.opening.value), openingDate: E.openingDate.value, notes: E.notes.value.trim()
      };
      upsert('clients', rec);
      closeDrawer(); render(); toast('Client saved');
    };
  }

  /* ---------- bill / quotation editor ---------- */
  function itemRowHTML(it, i) {
    return '<tr data-i="' + i + '">' +
      '<td><textarea name="desc" rows="2" placeholder="Particulars of professional work">' + esc(it.desc || '') + '</textarea></td>' +
      '<td style="width:94px"><select name="kind">' +
      '<option value="fee"' + (it.kind !== 'expense' ? ' selected' : '') + '>Fee</option>' +
      '<option value="expense"' + (it.kind === 'expense' ? ' selected' : '') + '>Expense</option></select></td>' +
      '<td style="width:66px"><input name="qty" type="number" step="0.01" value="' + (it.qty == null ? 1 : it.qty) + '"></td>' +
      '<td style="width:106px"><input name="rate" type="number" step="0.01" value="' + (it.rate == null ? '' : it.rate) + '"></td>' +
      '<td style="width:104px" class="num amt">' + money(num(it.qty) * num(it.rate)) + '</td>' +
      '<td style="width:26px"><button type="button" class="del" data-del="' + i + '" title="Remove">&times;</button></td></tr>';
  }

  function itemsTableHTML(items) {
    return '<table class="items"><thead><tr><th>Particulars</th><th>Type</th><th>Qty</th><th>Rate</th><th class="num">Amount</th><th></th></tr></thead>' +
      '<tbody id="itemBody">' + items.map(itemRowHTML).join('') + '</tbody></table>' +
      '<div style="margin-top:8px"><button type="button" class="btn sm" id="addItem">+ Add row</button></div>';
  }

  function totalsBoxHTML(t) {
    var h = '<div class="totals-box">';
    h += '<div><span>Professional fees</span><span class="num">' + money(t.fees) + '</span></div>';
    if (t.expenses) h += '<div><span>Out of pocket expenses</span><span class="num">' + money(t.expenses) + '</span></div>';
    if (t.discount) h += '<div><span>Less: concession</span><span class="num">' + money(t.discount) + '</span></div>';
    h += '<div><span>Total</span><span class="num">' + rs(t.total) + '</span></div></div>';
    return h;
  }

  function editDoc(kind, id, preset) {
    // kind: 'quote' | 'invoice'
    var store = kind === 'quote' ? DB.quotes : DB.invoices;
    var d = id ? store.find(function (x) { return x.id === id; }) : null;
    var S = DB.settings;
    var isQ = kind === 'quote';
    var blank = {
      id: '', no: '', date: todayISO(), clientId: '', subject: '', matter: '', intro: '',
      items: [{ desc: '', kind: 'fee', qty: 1, rate: '' }], discount: 0,
      terms: isQ ? S.quoteTerms : S.invoiceTerms, status: isQ ? 'Draft' : '', showPaid: false, validity: '30 days'
    };
    d = d ? JSON.parse(JSON.stringify(d)) : Object.assign(blank, preset || {});
    if (!d.no) d.no = nextNo(isQ ? 'Q' : 'I', d.date);
    if (!d.items || !d.items.length) d.items = [{ desc: '', kind: 'fee', qty: 1, rate: '' }];
    draft = d; draftKind = kind;

    var body =
      '<form id="docForm" class="fields">' +
      '<label class="c2">Client<select name="clientId" required>' + clientOptions(d.clientId) + '</select></label>' +
      '<label>Number<input name="no" value="' + esc(d.no) + '"></label>' +
      '<label>Date<input name="date" type="date" value="' + esc(d.date) + '"></label>' +
      '<label class="c4">Subject / short title<input name="subject" value="' + esc(d.subject) + '" placeholder="e.g. Professional charges for MahaRERA complaint"></label>' +
      '<label class="c4">Matter / case particulars<textarea name="matter" rows="2">' + esc(d.matter) + '</textarea></label>' +
      '<label class="c4">Opening paragraph (optional)<textarea name="intro" rows="2" placeholder="' +
      (isQ ? 'With reference to your instructions, our fee estimate for the work is set out below.' : 'Professional bill for the services rendered as detailed below.') +
      '">' + esc(d.intro) + '</textarea></label>' +
      (isQ ? '<label class="c2">Validity<input name="validity" value="' + esc(d.validity || '') + '"></label>' +
        '<label class="c2">Status<select name="status">' +
        ['Draft', 'Sent', 'Accepted', 'Declined', 'Converted'].map(function (s) {
          return '<option' + (d.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></label>' : '') +
      '<div class="c4"><div class="section-label">Particulars</div>' + itemsTableHTML(d.items) + '</div>' +
      '<label class="c2">Less: concession / discount<input name="discount" type="number" step="0.01" value="' + num(d.discount) + '"></label>' +
      (isQ ? '' : '<label class="c2 check" style="align-self:end"><input type="checkbox" name="showPaid"' + (d.showPaid ? ' checked' : '') +
        '> Show payments received on the bill</label>') +
      '<div class="c4" id="totalsHost">' + totalsBoxHTML(docTotals(d)) + '</div>' +
      '<label class="c4">Terms / notes printed at the foot<textarea name="terms" rows="4">' + esc(d.terms || '') + '</textarea></label>' +
      '</form>';

    openDrawer((id ? 'Edit ' : 'New ') + (isQ ? 'quotation' : 'invoice'), body,
      '<button class="btn ghost" data-close>Cancel</button>' +
      '<button class="btn" id="saveDoc">Save</button>' +
      '<button class="btn primary" id="saveViewDoc">Save &amp; preview</button>');

    var form = $('#docForm');

    function collect() {
      var items = $$('#itemBody tr').map(function (tr) {
        return {
          desc: $('[name=desc]', tr).value.trim(),
          kind: $('[name=kind]', tr).value,
          qty: num($('[name=qty]', tr).value),
          rate: num($('[name=rate]', tr).value)
        };
      });
      var rec = {
        id: d.id || uid(),
        no: form.no.value.trim(), date: form.date.value, clientId: form.clientId.value,
        subject: form.subject.value.trim(), matter: form.matter.value.trim(), intro: form.intro.value.trim(),
        items: items, discount: num(form.discount.value), terms: form.terms.value
      };
      if (isQ) { rec.validity = form.validity.value; rec.status = form.status.value; }
      else { rec.showPaid = !!form.showPaid.checked; rec.cancelled = d.cancelled || false; rec.quoteId = d.quoteId || ''; }
      return rec;
    }

    function recalc() {
      $$('#itemBody tr').forEach(function (tr) {
        $('.amt', tr).textContent = money(num($('[name=qty]', tr).value) * num($('[name=rate]', tr).value));
      });
      $('#totalsHost').innerHTML = totalsBoxHTML(docTotals(collect()));
    }

    form.addEventListener('input', function (e) {
      if (e.target.name === 'date' && !id) { form.no.value = nextNo(isQ ? 'Q' : 'I', form.date.value); }
      recalc();
    });
    $('#addItem').onclick = function () {
      var tb = $('#itemBody');
      tb.insertAdjacentHTML('beforeend', itemRowHTML({ desc: '', kind: 'fee', qty: 1, rate: '' }, tb.children.length));
      recalc();
    };
    $('#itemBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      if ($('#itemBody').children.length === 1) { toast('At least one row is needed'); return; }
      b.closest('tr').remove(); recalc();
    });

    function persist() {
      var rec = collect();
      if (!rec.clientId) { toast('Please select a client'); return null; }
      if (!rec.items.some(function (i) { return i.desc || i.rate; })) { toast('Add at least one particular'); return null; }
      rec.items = rec.items.filter(function (i) { return i.desc || i.rate; });
      upsert(isQ ? 'quotes' : 'invoices', rec);
      if (!isQ && rec.quoteId) {
        var q = DB.quotes.find(function (x) { return x.id === rec.quoteId; });
        if (q && q.status !== 'Converted') { q.status = 'Converted'; upsert('quotes', q); }
      }
      render(); toast('Saved');
      return rec;
    }

    $('#saveDoc').onclick = function () { if (persist()) closeDrawer(); };
    $('#saveViewDoc').onclick = function () {
      var rec = persist(); if (!rec) return;
      closeDrawer(); isQ ? previewQuote(rec.id) : previewInvoice(rec.id);
    };
  }

  /* ---------- receipt editor ---------- */
  function editReceipt(id, preset) {
    var r = id ? DB.receipts.find(function (x) { return x.id === id; }) : null;
    r = r ? JSON.parse(JSON.stringify(r)) : Object.assign({
      id: '', no: '', date: todayISO(), clientId: '', invoiceId: '', amount: '',
      mode: 'Cheque', ref: '', bank: '', notes: '', towards: ''
    }, preset || {});
    if (!r.no) r.no = nextNo('R', r.date);

    function invOptions(clientId, sel) {
      var list = DB.invoices.filter(function (i) { return i.clientId === clientId && !i.cancelled; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      return '<option value="">On account (not against a specific bill)</option>' + list.map(function (i) {
        var bal = r2(docTotals(i).total - paidOn(i.id));
        return '<option value="' + i.id + '"' + (i.id === sel ? ' selected' : '') + '>' +
          esc(i.no) + ' &middot; ' + fmtDate(i.date) + ' &middot; balance ' + money(bal) + '</option>';
      }).join('');
    }

    openDrawer(id ? 'Edit receipt' : 'New receipt',
      '<form id="rForm" class="fields">' +
      '<label class="c2">Client<select name="clientId" required>' + clientOptions(r.clientId) + '</select></label>' +
      '<label>Receipt no.<input name="no" value="' + esc(r.no) + '"></label>' +
      '<label>Date<input name="date" type="date" value="' + esc(r.date) + '"></label>' +
      '<label class="c4">Against bill<select name="invoiceId" id="invSel">' + invOptions(r.clientId, r.invoiceId) + '</select></label>' +
      '<label class="c2">Amount received<input name="amount" type="number" step="0.01" value="' + (r.amount === '' ? '' : num(r.amount)) + '" required></label>' +
      '<label class="c2">Mode<select name="mode">' +
      ['Cash', 'Cheque', 'NEFT / RTGS', 'UPI', 'Bank transfer', 'Demand draft'].map(function (m) {
        return '<option' + (r.mode === m ? ' selected' : '') + '>' + m + '</option>';
      }).join('') + '</select></label>' +
      '<label class="c2">Cheque / transaction reference<input name="ref" value="' + esc(r.ref) + '" placeholder="Cheque no. 123456 dated 01/04/2026"></label>' +
      '<label class="c2">Drawn on bank<input name="bank" value="' + esc(r.bank || '') + '"></label>' +
      '<label class="c4">Towards (printed on the receipt)<input name="towards" value="' + esc(r.towards || '') + '" placeholder="professional fees in the matter of ..."></label>' +
      '<label class="c4">Internal note<input name="notes" value="' + esc(r.notes || '') + '"></label>' +
      '<div class="c4 sub" id="rHint"></div>' +
      '</form>',
      '<button class="btn ghost" data-close>Cancel</button>' +
      '<button class="btn" id="saveR">Save</button>' +
      '<button class="btn primary" id="saveViewR">Save &amp; preview</button>');

    var f = $('#rForm');
    f.clientId.onchange = function () { $('#invSel').innerHTML = invOptions(f.clientId.value, ''); hint(); };
    f.addEventListener('input', hint);
    function hint() {
      var h = '';
      if (f.invoiceId.value) {
        var inv = DB.invoices.find(function (i) { return i.id === f.invoiceId.value; });
        if (inv) {
          var t = docTotals(inv).total, p = paidOn(inv.id) - (id ? num(r.amount) : 0);
          var after = r2(t - p - num(f.amount.value));
          h = 'Bill ' + inv.no + ': total ' + rs(t) + ', already received ' + rs(p) +
            ', balance after this receipt ' + rs(after) + (after > 0.009 ? ' (part payment)' : ' (fully paid)');
        }
      } else if (f.clientId.value) {
        h = 'Client balance before this receipt: ' + rs(clientBalance(f.clientId.value));
      }
      $('#rHint').innerHTML = '<span class="sub">' + esc(h) + '</span>';
    }
    hint();

    function persist() {
      if (!f.clientId.value) { toast('Please select a client'); return null; }
      if (!num(f.amount.value)) { toast('Enter the amount received'); return null; }
      var rec = {
        id: r.id || uid(), no: f.no.value.trim(), date: f.date.value, clientId: f.clientId.value,
        invoiceId: f.invoiceId.value, amount: num(f.amount.value), mode: f.mode.value,
        ref: f.ref.value.trim(), bank: f.bank.value.trim(), towards: f.towards.value.trim(), notes: f.notes.value.trim()
      };
      upsert('receipts', rec);
      render(); toast('Receipt saved');
      return rec;
    }
    $('#saveR').onclick = function () { if (persist()) closeDrawer(); };
    $('#saveViewR').onclick = function () { var rec = persist(); if (rec) { closeDrawer(); previewReceipt(rec.id); } };
  }

  /* ---------- adjustment editor ---------- */
  function editAdjustment() {
    var cid = $('#ledgerClient').value;
    openDrawer('Ledger adjustment',
      '<form id="aForm" class="fields">' +
      '<label class="c2">Client<select name="clientId">' + clientOptions(cid) + '</select></label>' +
      '<label class="c2">Date<input name="date" type="date" value="' + todayISO() + '"></label>' +
      '<label class="c4">Narration<input name="narration" placeholder="e.g. Court fee paid on behalf of client / Amount written off"></label>' +
      '<label class="c2">Debit (client owes more)<input name="debit" type="number" step="0.01"></label>' +
      '<label class="c2">Credit (client owes less)<input name="credit" type="number" step="0.01"></label>' +
      '<label class="c4">Voucher reference<input name="ref"></label>' +
      '</form>',
      '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveAdj">Save entry</button>');

    $('#saveAdj').onclick = function () {
      var f = $('#aForm');
      if (!f.clientId.value) { toast('Select a client'); return; }
      if (!num(f.debit.value) && !num(f.credit.value)) { toast('Enter a debit or a credit amount'); return; }
      upsert('adjustments', {
        id: uid(), clientId: f.clientId.value, date: f.date.value, narration: f.narration.value.trim(),
        debit: num(f.debit.value), credit: num(f.credit.value), ref: f.ref.value.trim()
      });
      closeDrawer(); $('#ledgerClient').value = f.clientId.value; render(); toast('Entry added');
    };
  }

  /* ============================================================
     DOCUMENT SPECS + PREVIEW
     ============================================================ */
  var previewSpec = null, previewEdit = null;

  function toBlock(c) {
    return c ? { name: c.name, addr: c.addr, phone: c.phone } : { name: '(client deleted)', addr: '', phone: '' };
  }

  function billSpec(d, kind) {
    var S = DB.settings, t = docTotals(d), isQ = kind === 'quote';
    var rows = (d.items || []).map(function (it, i) {
      return [
        { t: String(i + 1), align: 'center' },
        { t: it.desc + (it.kind === 'expense' ? '' : ''), sub: it.kind === 'expense' ? 'Out of pocket expense' : '' },
        { t: num(it.qty) === 1 ? '1' : String(num(it.qty)), align: 'center' },
        { t: money(it.rate), align: 'right' },
        { t: money(num(it.qty) * num(it.rate)), align: 'right' }
      ];
    });
    var totals = [];
    if (t.expenses) {
      totals.push({ label: 'Professional fees', value: money(t.fees) });
      totals.push({ label: 'Out of pocket expenses', value: money(t.expenses) });
    }
    if (t.discount) totals.push({ label: 'Less: concession', value: money(t.discount) });
    totals.push({ label: isQ ? 'Estimated total' : 'Total payable', value: rs(t.total), grand: true });

    if (!isQ && d.showPaid) {
      var p = paidOn(d.id);
      if (p) {
        totals.push({ label: 'Less: amount received', value: money(p) });
        totals.push({ label: 'Balance due', value: rs(r2(t.total - p)), grand: true });
      }
    }

    var blocks = [];
    if (isQ && d.validity) blocks.push({ hd: 'Validity', text: 'This quotation is valid for ' + d.validity + ' from the date hereof.' });
    if (d.terms) blocks.push({ hd: isQ ? 'Terms' : 'Terms of payment', text: d.terms });

    return {
      kind: 'bill',
      title: isQ ? 'Quotation' : 'Bill of Costs',
      no: d.no, date: fmtDate(d.date), dateLabel: 'Date',
      to: toBlock(client(d.clientId)), toLabel: 'To',
      matter: d.matter, matterLabel: 'Matter',
      intro: d.intro || (isQ
        ? 'With reference to your instructions, the estimate of professional charges for the work is set out below.'
        : 'Bill of professional charges for the services rendered, as detailed below.'),
      cols: [
        { t: 'Sr.', w: 7, align: 'center' },
        { t: 'Particulars', w: 53 },
        { t: 'Qty', w: 9, align: 'center' },
        { t: 'Rate', w: 14, align: 'right' },
        { t: 'Amount', w: 17, align: 'right' }
      ],
      rows: rows,
      totalRows: totals,
      words: inWords(t.total),
      blocks: blocks,
      fileName: (isQ ? 'Quotation ' : 'Bill ') + (d.no || '').replace(/[\/\\]/g, '-') + ' - ' + clientName(d.clientId)
    };
  }

  function receiptSpec(r) {
    var inv = DB.invoices.find(function (i) { return i.id === r.invoiceId; });
    var bal = '';
    if (inv) {
      var t = docTotals(inv).total, p = paidOn(inv.id);
      bal = 'Against Bill No. ' + inv.no + ' dated ' + fmtDate(inv.date) + '\n' +
        'Bill amount ' + rs(t) + '  |  Received till date ' + rs(p) + '\n' +
        'Balance ' + rs(r2(t - p)) + (r2(t - p) > 0.009 ? '  (part payment)' : '  (bill settled in full)');
    } else {
      bal = 'Received on account.\nBalance outstanding as on ' + fmtDate(r.date) + ': ' + rs(clientBalance(r.clientId));
    }
    var modeTxt = r.mode + (r.bank ? ' drawn on ' + r.bank : '');
    return {
      kind: 'receipt',
      title: 'Receipt',
      no: r.no, date: fmtDate(r.date), dateLabel: 'Date',
      to: toBlock(client(r.clientId)), toLabel: 'Received from',
      matter: r.towards || (inv ? inv.matter : ''),
      matterLabel: 'Towards',
      receipt: {
        amount: rs(r.amount),
        words: inWords(r.amount),
        mode: modeTxt,
        ref: r.ref,
        against: inv ? 'Bill No. ' + inv.no + ' dated ' + fmtDate(inv.date) : (r.towards || 'professional charges'),
        balanceLine: bal
      },
      blocks: [],
      fileName: 'Receipt ' + (r.no || '').replace(/[\/\\]/g, '-') + ' - ' + clientName(r.clientId)
    };
  }

  function ledgerSpec(clientId, from, to) {
    var L = ledgerRows(clientId, from, to), c = client(clientId);
    var rows = [[
      { t: from ? fmtDate(from) : '', align: 'center' },
      { t: 'Opening balance', strong: true }, { t: '' },
      { t: L.opening > 0 ? money(L.opening) : '', align: 'right' },
      { t: L.opening < 0 ? money(-L.opening) : '', align: 'right' },
      { t: money(Math.abs(L.opening)) + ' ' + (L.opening < 0 ? 'Cr' : 'Dr'), align: 'right' }
    ]];
    L.rows.forEach(function (r) {
      rows.push([
        { t: fmtDate(r.date), align: 'center' },
        { t: r.particulars },
        { t: r.ref || '' },
        { t: r.debit ? money(r.debit) : '', align: 'right' },
        { t: r.credit ? money(r.credit) : '', align: 'right' },
        { t: money(Math.abs(r.balance)) + ' ' + (r.balance < 0 ? 'Cr' : 'Dr'), align: 'right' }
      ]);
    });
    var period = (from ? 'From ' + fmtDate(from) : 'From inception') + ' to ' + (to ? fmtDate(to) : fmtDate(todayISO()));
    return {
      kind: 'ledger', wideTable: true, flow: true,
      title: 'Statement of Account',
      no: '', date: fmtDate(todayISO()), dateLabel: 'Prepared on',
      to: toBlock(c), toLabel: 'Account of',
      matter: period, matterLabel: 'Period',
      cols: [
        { t: 'Date', w: 13, align: 'center' },
        { t: 'Particulars', w: 38 },
        { t: 'Voucher', w: 13 },
        { t: 'Debit', w: 12, align: 'right' },
        { t: 'Credit', w: 12, align: 'right' },
        { t: 'Balance', w: 12, align: 'right' }
      ],
      rows: rows,
      totalRows: [{ label: 'Closing balance', value: money(Math.abs(L.closing)) + ' ' + (L.closing < 0 ? 'Cr' : 'Dr'), grand: true }],
      words: L.closing > 0 ? 'Amount due from client: ' + inWords(L.closing) : (L.closing < 0 ? 'Amount in credit: ' + inWords(-L.closing) : 'Account settled in full'),
      blocks: [{ hd: 'Note', text: 'This statement is subject to verification. Please intimate any discrepancy within seven days.' }],
      footNote: 'Statement of account — ' + c.name,
      fileName: 'Statement ' + c.name
    };
  }

  /* ---------- preview plumbing ---------- */
  function showPreview(spec, editFn) {
    previewSpec = spec; previewEdit = editFn || null;
    $('#previewTitle').textContent = spec.title + (spec.no ? '  ' + spec.no : '');
    $('#paperHost').innerHTML = DocRender.html(spec, DB.settings);
    $('#btnDocEdit').classList.toggle('hidden', !editFn);
    $('#preview').classList.remove('hidden');
  }
  function previewQuote(id) {
    var d = DB.quotes.find(function (x) { return x.id === id; }); if (!d) return;
    showPreview(billSpec(d, 'quote'), function () { editDoc('quote', id); });
  }
  function previewInvoice(id) {
    var d = DB.invoices.find(function (x) { return x.id === id; }); if (!d) return;
    showPreview(billSpec(d, 'invoice'), function () { editDoc('invoice', id); });
  }
  function previewReceipt(id) {
    var r = DB.receipts.find(function (x) { return x.id === id; }); if (!r) return;
    showPreview(receiptSpec(r), function () { editReceipt(id); });
  }
  function previewLedger(cid, from, to) { showPreview(ledgerSpec(cid, from, to), null); }

  // Page geometry is written at print time. A single-page document is laid out
  // edge to edge so the letterhead sits exactly where it does on screen; a
  // statement that may run over several pages uses ordinary page margins.
  function setPageStyle(flow) {
    var st = document.getElementById('pageStyle') || document.createElement('style');
    st.id = 'pageStyle';
    var a4 = DB.settings.paper === 'A4';
    var size = (a4 ? 'A4' : 'A5') + ' portrait';
    var sideM = a4 ? 16 : 11, topM = a4 ? 14 : 10, botM = a4 ? 12 : 9;
    var css;
    if (flow) {
      css = '@page{size:' + size + ';margin:' + topM + 'mm ' + sideM + 'mm ' + botM + 'mm}' +
        '#printHost .paper{width:auto;min-height:0;padding:0;display:block}';
    } else {
      css = '@page{size:' + size + ';margin:0}' +
        '#printHost .paper{width:' + (a4 ? 210 : 148) + 'mm;height:' + (a4 ? 295 : 208) + 'mm;' +
        'padding:' + topM + 'mm ' + sideM + 'mm ' + botM + 'mm;display:block;position:relative}' +
        '#printHost .paper .foot{position:absolute;left:' + sideM + 'mm;right:' + sideM + 'mm;bottom:' + botM + 'mm;margin:0}';
    }
    st.textContent = '@media print{' + css + '}';
    document.head.appendChild(st);
  }

  // A long bill should flow onto a second page instead of colliding with the
  // bottom-anchored signature block, so measure the preview before printing.
  function contentOverflows() {
    var paper = $('#paperHost .paper'); if (!paper) return false;
    var MM = 96 / 25.4, pageH = (DB.settings.paper === 'A4' ? 297 : 210) * MM;
    var ps = getComputedStyle(paper);
    var total = parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom);
    Array.prototype.forEach.call(paper.children, function (ch) {
      var cs = getComputedStyle(ch);
      var mt = ch.classList.contains('foot') ? 8 : (parseFloat(cs.marginTop) || 0);
      total += ch.offsetHeight + mt + (parseFloat(cs.marginBottom) || 0);
    });
    return total > pageH - 6 * MM;
  }

  function doPrint() {
    if (!previewSpec) return;
    setPageStyle(previewSpec.flow || contentOverflows());
    $('#printHost').innerHTML = DocRender.html(previewSpec, DB.settings);
    setTimeout(function () { window.print(); }, 80);
  }

  function doDocx() {
    if (!previewSpec) return;
    try {
      var blob = DocRender.docx(previewSpec, DB.settings);
      DocxKit.saveBlob(blob, (previewSpec.fileName || 'document') + '.docx');
      toast('Word file downloaded');
    } catch (e) {
      console.error(e); toast('Could not build the Word file');
    }
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function fillSettings() {
    var f = $('#settingsForm'), S = DB.settings;
    Object.keys(S).forEach(function (k) {
      var el = f.elements[k]; if (!el) return;
      if (el.type === 'checkbox') el.checked = !!S[k]; else el.value = S[k];
    });

    var info = $('#storageInfo'), html;
    if (Store.mode === 'cloud') {
      html = '<p class="sub" style="margin:0 0 8px">Signed in as <b>' + esc(Store.user ? Store.user.email : '') +
        '</b>. Records are kept in the Firebase project and reach every device you sign in on. ' +
        'They are also cached here, so the office keeps working when the internet is down.</p>' +
        '<button type="button" class="btn sm" id="btnGoLocal">Switch this device to offline-only</button>';
      var pending = Store.localRecordCount ? Store.localRecordCount() : 0;
      if (pending) {
        html += ' <button type="button" class="btn sm primary" id="btnImportLocal">Upload ' + pending +
          ' record(s) entered on this device before sign-in</button>';
      }
    } else if (Store.configured) {
      html = '<p class="sub" style="margin:0 0 8px">This device is set to <b>offline-only</b>. ' +
        'Records entered here stay here and do not reach your other devices.</p>' +
        '<button type="button" class="btn sm primary" id="btnGoCloud">Sign in and use the cloud</button>';
    } else {
      html = '<p class="sub" style="margin:0 0 8px">Firebase is not configured, so records are kept in this browser only. ' +
        'Fill in <b>js/firebase-config.js</b> and follow <b>SETUP-FIREBASE.md</b> to put them online. ' +
        'Until then, use <b>Backup</b> every day.</p>';
    }
    info.innerHTML = html;
    if ($('#btnGoLocal')) $('#btnGoLocal').onclick = function () {
      if (confirm('Switch this device to offline-only?')) Store.useLocalOnly();
    };
    if ($('#btnGoCloud')) $('#btnGoCloud').onclick = function () { Store.useCloud(); };
    if ($('#btnImportLocal')) $('#btnImportLocal').onclick = function () {
      if (!confirm('Copy the records held on this device into the cloud? Records already in the cloud are kept.')) return;
      Store.importLocal()
        .then(function (n) { toast(n + ' record(s) uploaded'); })
        .catch(function (e) { toast('Upload failed: ' + e.message); });
    };
  }
  function saveSettings(e) {
    e.preventDefault();
    var f = $('#settingsForm');
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      var el = f.elements[k]; if (!el) return;
      DB.settings[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    persistSettings(); setPageStyle(); render(); toast('Settings saved');
  }

  /* ---------- backup / restore ---------- */
  function backup() {
    var blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    DocxKit.saveBlob(blob, 'advocate-billing-backup-' + todayISO() + '.json');
    toast('Backup downloaded');
  }
  function restore(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || typeof d !== 'object') throw 0;
        var where = Store.mode === 'cloud' ? 'in the Firebase project' : 'in this browser';
        if (!confirm('Replace all records ' + where + ' with the contents of this backup?')) return;
        adoptLocal(d);
        render();
        Promise.resolve(Store.replaceAll(DB))
          .then(function () { toast('Backup restored'); })
          .catch(function (err) { toast('Restored here, but the upload failed: ' + err.message); });
      } catch (e) { toast('That file could not be read'); }
    };
    fr.readAsText(file);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function wire() {
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (b) switchTab(b.dataset.tab);
    });

    $('#btnNewClient').onclick = function () { editClient(''); };
    $('#btnNewQuote').onclick = function () { editDoc('quote', ''); };
    $('#btnNewInvoice').onclick = function () { editDoc('invoice', ''); };
    $('#btnNewReceipt').onclick = function () { editReceipt(''); };
    $('#btnLedgerAdj').onclick = editAdjustment;

    ['clientSearch', 'quoteSearch', 'invoiceSearch', 'receiptSearch'].forEach(function (id) {
      $('#' + id).addEventListener('input', render);
    });
    $('#dashFY').addEventListener('change', renderDashboard);
    $('#ledgerClient').addEventListener('change', renderLedger);
    $('#ledgerFrom').addEventListener('change', renderLedger);
    $('#ledgerTo').addEventListener('change', renderLedger);

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goledger],[data-editclient],[data-delclient],[data-viewq],[data-editq],[data-delq],' +
        '[data-conv],[data-viewi],[data-editi],[data-deli],[data-recpt],[data-viewr],[data-editr],[data-delr],[data-deladj],[data-close]');
      if (!t) return;
      var d = t.dataset;
      if (d.close !== undefined) return closeDrawer();
      if (d.goledger) { switchTab('ledger'); $('#ledgerClient').value = d.goledger; renderLedger(); }
      if (d.editclient) editClient(d.editclient);
      if (d.delclient) {
        var c = client(d.delclient);
        var used = DB.invoices.concat(DB.quotes, DB.receipts).some(function (x) { return x.clientId === d.delclient; });
        if (used) { toast('This client has documents. Delete those first.'); return; }
        if (confirm('Delete client ' + c.name + '?')) {
          DB.adjustments.filter(function (x) { return x.clientId === d.delclient; })
            .forEach(function (a) { dropRec('adjustments', a.id); });
          dropRec('clients', d.delclient);
          render();
        }
      }
      if (d.viewq) previewQuote(d.viewq);
      if (d.editq) editDoc('quote', d.editq);
      if (d.delq && confirm('Delete this quotation?')) { dropRec('quotes', d.delq); render(); }
      if (d.conv) {
        var q = DB.quotes.find(function (x) { return x.id === d.conv; });
        if (q) {
          editDoc('invoice', '', {
            clientId: q.clientId, subject: q.subject, matter: q.matter,
            items: JSON.parse(JSON.stringify(q.items)), discount: q.discount,
            terms: DB.settings.invoiceTerms, quoteId: q.id, date: todayISO()
          });
        }
      }
      if (d.viewi) previewInvoice(d.viewi);
      if (d.editi) editDoc('invoice', d.editi);
      if (d.deli && confirm('Delete this invoice? Receipts linked to it will become on-account receipts.')) {
        DB.receipts.filter(function (r) { return r.invoiceId === d.deli; })
          .forEach(function (r) { r.invoiceId = ''; upsert('receipts', r); });
        dropRec('invoices', d.deli);
        render();
      }
      if (d.recpt) {
        var inv = DB.invoices.find(function (x) { return x.id === d.recpt; });
        if (inv) editReceipt('', {
          clientId: inv.clientId, invoiceId: inv.id,
          amount: r2(docTotals(inv).total - paidOn(inv.id)),
          towards: inv.subject || inv.matter
        });
      }
      if (d.viewr) previewReceipt(d.viewr);
      if (d.editr) editReceipt(d.editr);
      if (d.delr && confirm('Delete this receipt?')) { dropRec('receipts', d.delr); render(); }
      if (d.deladj && confirm('Delete this adjustment entry?')) { dropRec('adjustments', d.deladj); render(); }
    });

    $('#drawerClose').onclick = closeDrawer;
    $('#drawer').addEventListener('mousedown', function (e) { if (e.target === e.currentTarget) closeDrawer(); });

    $('#previewClose').onclick = function () { $('#preview').classList.add('hidden'); };
    $('#btnDocPrint').onclick = doPrint;
    $('#btnDocPdf').onclick = function () {
      toast('Choose "Save as PDF" as the destination, and set Margins to None');
      doPrint();
    };
    $('#btnDocDocx').onclick = doDocx;
    $('#btnDocEdit').onclick = function () {
      $('#preview').classList.add('hidden');
      if (previewEdit) previewEdit();
    };

    $('#settingsForm').addEventListener('submit', saveSettings);
    $('#btnWipe').onclick = function () {
      var where = Store.mode === 'cloud' ? 'in the Firebase project, on every device' : 'stored in this browser';
      if (!confirm('This erases every client, quotation, invoice and receipt ' + where + '. Continue?')) return;
      if (!confirm('Last check — this cannot be undone. Take a backup first if you have not.')) return;
      Promise.resolve(Store.wipe()).then(function () {
        DB.settings = Object.assign({}, DEFAULT_SETTINGS);
        DB.clients = []; DB.quotes = []; DB.invoices = []; DB.receipts = []; DB.adjustments = [];
        render(); toast('All data erased');
      }).catch(function (e) { toast('Could not erase: ' + e.message); });
    };

    $('#btnBackup').onclick = backup;
    $('#btnRestore').onclick = function () { $('#fileRestore').click(); };
    $('#fileRestore').onchange = function (e) { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#preview').classList.contains('hidden')) $('#preview').classList.add('hidden');
        else if (!$('#drawer').classList.contains('hidden')) closeDrawer();
      }
    });
    window.addEventListener('afterprint', function () { $('#printHost').innerHTML = ''; });
  }

  /* ============================================================
     SIGN IN  (only used when Firebase is configured)
     ============================================================ */
  function authMsg(text, ok) {
    var m = $('#authMsg');
    m.textContent = text || '';
    m.classList.toggle('hidden', !text);
    m.classList.toggle('ok', !!ok);
  }
  function showAuth(checking) {
    var g = $('#authGate');
    g.classList.remove('hidden');
    g.classList.toggle('checking', !!checking);
  }
  function hideAuth() { $('#authGate').classList.add('hidden'); authMsg(''); }

  function authError(e) {
    var c = (e && e.code) || '';
    if (c === 'auth/invalid-email') return 'That email address does not look right.';
    if (c === 'auth/user-not-found' || c === 'auth/wrong-password' || c === 'auth/invalid-credential')
      return 'Email or password is not correct.';
    if (c === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
    if (c === 'auth/network-request-failed') return 'No internet connection.';
    if (c === 'auth/unauthorized-domain') return 'This web address is not in the Firebase list of authorised domains.';
    if (c === 'auth/operation-not-allowed') return 'Email sign-in is not switched on in the Firebase console.';
    return (e && e.message) || 'Sign in failed.';
  }

  function wireAuth() {
    $('#authForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var E = e.target.elements, btn = $('#btnSignIn');
      authMsg(''); btn.disabled = true; btn.textContent = 'Signing in…';
      Store.signIn(E.email.value, E.password.value)
        .catch(function (err) { authMsg(authError(err)); })
        .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
    });
    $('#btnForgot').onclick = function () {
      var email = $('#authForm').elements.email.value.trim();
      if (!email) { authMsg('Type the email address first, then press this again.'); return; }
      Store.resetPassword(email)
        .then(function () { authMsg('A password reset link has been sent to ' + email, true); })
        .catch(function (err) { authMsg(authError(err)); });
    };
    $('#btnLocalMode').onclick = function () {
      if (confirm('Work on this device only? Records entered here will stay on this device and will not reach the other devices until you sign in again.')) {
        Store.useLocalOnly();
      }
    };
    $('#btnSignOut').onclick = function () {
      if (confirm('Sign out of this device?')) Store.signOut();
    };
  }

  function setBadge(text, cls) {
    var b = $('#syncBadge');
    b.textContent = text;
    b.className = 'sync ' + (cls || '');
    b.title = Store.mode === 'cloud'
      ? 'Signed in' + (Store.user ? ' as ' + Store.user.email : '') + '. Records are kept in the Firebase project.'
      : 'Records are kept in this browser only. Use Backup regularly.';
  }

  /* ---------------- init ---------------- */
  var settingsSeeded = false;
  wire();
  wireAuth();

  // carry any letterhead already set up on this device into the cloud seed
  var seed = Store.localSnapshot && Store.localSnapshot();
  if (seed && seed.settings) DB.settings = Object.assign({}, DEFAULT_SETTINGS, seed.settings);
  setPageStyle();

  Store.start({
    onLocalData: function (d) { adoptLocal(d); },
    onData: function (coll, arr) { DB[coll] = arr; render(); },
    onSettings: function (s) {
      // first sign-in on a fresh project: put the current letterhead up so the
      // settings document exists and other devices pick it up
      if (!s && Store.mode === 'cloud' && !settingsSeeded) { settingsSeeded = true; persistSettings(); return; }
      DB.settings = Object.assign({}, DEFAULT_SETTINGS, s || {});
      setPageStyle(); render();
    },
    onSignedIn: function () { hideAuth(); $('#btnSignOut').classList.remove('hidden'); },
    onSignedOut: function () {
      $('#btnSignOut').classList.add('hidden');
      DB.clients = []; DB.quotes = []; DB.invoices = []; DB.receipts = []; DB.adjustments = [];
      showAuth(false);
    },
    onStatus: setBadge,
    onError: function (msg) { toast(msg); },
    onReady: function () { hideAuth(); switchTab('dashboard'); }
  });

  // in cloud mode hold the sign-in screen up until Firebase says who is signed in
  if (Store.mode === 'cloud') showAuth(true);

  if (Store.mode === 'local' && Store.sdkMissing) {
    toast('Firebase could not be reached. Working on this device for now.');
  }
})();
