/* ============================================================
   documents.js — renders a normalised DocSpec to
   (a) letterhead HTML for screen + print, and
   (b) Word .docx through DocxKit.
   ============================================================ */
(function (global) {
  'use strict';

  var K = global.DocxKit;
  var INK = '1A237E';

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function nl2br(s) { return h(s).replace(/\n/g, '<br>'); }

  /* ================= HTML ================= */

  function letterheadHTML(S) {
    if (!S.showLetterhead) return '<div style="height:16mm"></div>';
    var contact = [];
    if (S.phone) contact.push('Phone ' + S.phone);
    if (S.email) contact.push(S.email);
    if (S.pan) contact.push('PAN ' + S.pan);
    var addr = [S.addr1, S.addr2].filter(Boolean).join('<br>');
    return '' +
      '<div class="lh">' +
      '<div class="nm">' + h(S.name) + '</div>' +
      (S.qual ? '<div class="q">' + h(S.qual) + '</div>' : '') +
      '<div class="d">' + h(S.designation || 'ADVOCATE') + '</div>' +
      '<hr class="lh-rule">' +
      '<div class="ad">' + addr + (contact.length ? '<br>' + h(contact.join('  |  ')) : '') + '</div>' +
      '<hr class="lh-rule2">' +
      '</div>';
  }

  function toBlockHTML(spec) {
    if (!spec.to) return '';
    var a = spec.to.addr ? '<div class="ad">' + nl2br(spec.to.addr) + '</div>' : '';
    var p = spec.to.phone ? '<div class="ad">Phone ' + h(spec.to.phone) + '</div>' : '';
    return '<div class="to"><div class="lbl">' + h(spec.toLabel || 'To') + '</div>' +
      '<div class="nm">' + h(spec.to.name) + '</div>' + a + p + '</div>';
  }

  function tableHTML(spec) {
    if (!spec.cols) return '';
    var cls = spec.wideTable ? 'doc ledger' : 'doc';
    var out = '<table class="' + cls + '"><colgroup>' +
      spec.cols.map(function (c) { return '<col style="width:' + c.w + '%">'; }).join('') +
      '</colgroup><thead><tr>' +
      spec.cols.map(function (c) { return '<th style="text-align:' + (c.align || 'left') + '">' + h(c.t) + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    spec.rows.forEach(function (r) {
      out += '<tr>' + r.map(function (cl, i) {
        var al = cl.align || spec.cols[i].align || 'left';
        var cls2 = al === 'right' ? 'n' : (al === 'center' ? 'c' : '');
        return '<td class="' + cls2 + '">' + (cl.strong ? '<b>' : '') + nl2br(cl.t) + (cl.strong ? '</b>' : '') +
          (cl.sub ? '<div style="font-size:7.6pt;color:#555">' + nl2br(cl.sub) + '</div>' : '') + '</td>';
      }).join('') + '</tr>';
    });
    (spec.totalRows || []).forEach(function (t) {
      var span = spec.cols.length - 1;
      out += '<tr class="' + (t.grand ? 'grand' : 'tot') + '">' +
        '<td colspan="' + span + '" style="text-align:right">' + h(t.label) + '</td>' +
        '<td class="n">' + h(t.value) + '</td></tr>';
    });
    return out + '</tbody></table>';
  }

  function signHTML(S) {
    // the signature block already carries the round seal; S.showSeal adds a
    // second, standalone seal to the left of it
    var seal = S.showSeal ? '<img class="sealfloat" src="' + ASSETS.seal + '" alt="">' : '';
    var sign = S.showSign
      ? '<div class="signwrap"><img class="sig" src="' + ASSETS.signBlock + '" alt=""></div>'
      : '<div class="signwrap" style="padding-top:12mm"><div style="border-top:.6pt solid #333;width:42mm;margin:0 auto"></div>' +
      '<div class="cap"><b>' + h(S.name) + '</b><br>' + h(S.designation || 'Advocate') + '</div></div>';
    return '<div class="stamp-row">' + seal + sign + '</div>';
  }

  function payNoteHTML(S) {
    var lines = [];
    if (S.chequeNote) lines.push('<b>' + h(S.chequeNote) + '</b>');
    var bank = [];
    if (S.bankName) bank.push(S.bankName);
    if (S.bankAcct) bank.push('A/c ' + S.bankAcct);
    if (S.bankIfsc) bank.push('IFSC ' + S.bankIfsc);
    if (bank.length) lines.push(h(bank.join('  |  ')));
    if (S.bankUpi) lines.push('UPI ' + h(S.bankUpi));
    if (S.pan) lines.push('PAN ' + h(S.pan));
    return '<div class="pay">' + lines.join('<br>') + '</div>';
  }

  function renderHTML(spec, S) {
    var p = [];
    p.push('<div class="paper' + (S.paper === 'A4' ? ' a4' : '') + (spec.flow ? ' flow' : '') + '">');
    p.push(letterheadHTML(S));
    p.push('<div class="doctitle"><span>' + h(spec.title) + '</span></div>');

    var left = spec.no ? '<b>No.</b> ' + h(spec.no) : '';
    var right = '<b>' + h(spec.dateLabel || 'Date') + '</b> ' + h(spec.date || '');
    p.push('<div class="meta"><div>' + left + '</div><div>' + right + '</div></div>');

    p.push(toBlockHTML(spec));

    if (spec.matter)
      p.push('<div class="matter"><b>' + h(spec.matterLabel || 'Matter') + ':</b> ' + nl2br(spec.matter) + '</div>');

    if (spec.intro) p.push('<div class="body-note">' + nl2br(spec.intro) + '</div>');

    if (spec.kind === 'receipt') {
      var r = spec.receipt;
      p.push('<div class="rcpt-lines">');
      p.push('Received with thanks from <span class="fill">' + h(spec.to.name) + '</span>');
      p.push('<br>the sum of <span class="fill">' + h(r.words) + '</span>');
      p.push('<br>by <span class="fill">' + h(r.mode) + '</span>' + (r.ref ? ' vide <span class="fill">' + h(r.ref) + '</span>' : ''));
      if (r.against) p.push('<br>towards <span class="fill">' + h(r.against) + '</span>');
      p.push('</div>');
      p.push('<div class="rcpt-amt"><div class="box">' + h(r.amount) + '</div>' +
        (r.balanceLine ? '<div style="font-size:9pt;color:#333">' + nl2br(r.balanceLine) + '</div>' : '') + '</div>');
    } else {
      p.push(tableHTML(spec));
      if (spec.words) p.push('<div class="words"><b>Amount in words:</b> ' + h(spec.words) + '</div>');
    }

    (spec.blocks || []).forEach(function (b) {
      if (!b.text) return;
      p.push('<div class="terms"><div class="hd">' + h(b.hd) + '</div>' + nl2br(b.text) + '</div>');
    });

    p.push('<div class="foot">' + payNoteHTML(S) + signHTML(S) + '</div>');
    if (spec.footNote)
      p.push('<div class="pgfoot"><span>' + h(spec.footNote) + '</span><span>' + h(S.name) + '</span></div>');
    p.push('</div>');
    return p.join('');
  }

  /* ================= DOCX ================= */

  function docxLetterhead(d, S) {
    if (!S.showLetterhead) { d.p('', { sz: 20, after: 160 }); return; }
    d.p(S.name, { align: 'center', b: true, sz: 32, color: INK, spacing: 40, after: 0 });
    if (S.qual) d.p(S.qual, { align: 'center', sz: 15, spacing: 24, after: 0 });
    d.p(S.designation || 'ADVOCATE', { align: 'center', b: true, sz: 19, color: INK, spacing: 58, after: 20 });
    d.p('', { sz: 2, bottomBorder: { sz: 14, color: INK, space: 1 }, after: 40 });
    var contact = [];
    if (S.phone) contact.push('Phone ' + S.phone);
    if (S.email) contact.push(S.email);
    if (S.pan) contact.push('PAN ' + S.pan);
    var addr = [S.addr1, S.addr2].filter(Boolean).join('\n');
    if (addr) d.p(addr, { align: 'center', sz: 14, after: 0 });
    if (contact.length) d.p(contact.join('   |   '), { align: 'center', sz: 14, after: 10 });
    d.p('', { sz: 2, bottomBorder: { sz: 4, color: INK, space: 1 }, after: 80 });
  }

  function docxTitle(d, spec) {
    var cols = [d.contentWidth];
    d.add(K.table([
      K.row([K.cell([K.para(spec.title, { align: 'center', b: true, caps: true, sz: 21, color: INK, spacing: 70 })],
        { w: d.contentWidth, padV: 36 })])
    ], cols, { borders: { color: INK, sz: 6 } }));
    d.p('', { sz: 6, after: 60 });
  }

  function docxMeta(d, spec) {
    var half = Math.floor(d.contentWidth / 2);
    d.add(K.table([
      K.row([
        K.cell([spec.no
          ? K.para([K.run('No. ', { b: true, sz: 17 }), K.run(spec.no, { sz: 17 })])
          : K.para('', { sz: 17 })], { w: half, noBorder: true, padH: 0 }),
        K.cell([K.para([K.run((spec.dateLabel || 'Date') + ' ', { b: true, sz: 17 }), K.run(spec.date || '', { sz: 17 })], { align: 'right' })], { w: d.contentWidth - half, noBorder: true, padH: 0 })
      ])
    ], [half, d.contentWidth - half], { borders: false }));
    d.p('', { sz: 6, after: 50 });
  }

  function docxTo(d, spec) {
    if (!spec.to) return;
    d.p(spec.toLabel || 'To', { sz: 14, color: '555555', spacing: 20, after: 20 });
    d.p(spec.to.name, { b: true, sz: 19, after: 10 });
    if (spec.to.addr) d.p(spec.to.addr, { sz: 17, after: 10 });
    if (spec.to.phone) d.p('Phone ' + spec.to.phone, { sz: 17, after: 10 });
    d.p('', { sz: 6, after: 50 });
  }

  function docxTable(d, spec) {
    if (!spec.cols) return;
    var W = d.contentWidth;
    var cols = spec.cols.map(function (c) { return Math.round(W * c.w / 100); });
    var diff = W - cols.reduce(function (a, b) { return a + b; }, 0);
    cols[0] += diff;

    var rows = [K.row(spec.cols.map(function (c, i) {
      return K.cell([K.para(c.t, { b: true, sz: 15, color: INK, align: c.align === 'right' ? 'right' : (c.align === 'center' ? 'center' : 'left'), spacing: 12 })],
        { w: cols[i], shd: 'ECEEF6', padV: 34 });
    }), { header: true })];

    spec.rows.forEach(function (r) {
      rows.push(K.row(r.map(function (cl, i) {
        var al = cl.align || spec.cols[i].align || 'left';
        var ps = [K.para(cl.t, { sz: 17, b: !!cl.strong, align: al === 'right' ? 'right' : (al === 'center' ? 'center' : 'left') })];
        if (cl.sub) ps.push(K.para(cl.sub, { sz: 14, color: '555555' }));
        return K.cell(ps, { w: cols[i], vAlign: 'top', padV: 30 });
      })));
    });

    (spec.totalRows || []).forEach(function (t) {
      var span = spec.cols.length - 1;
      var leftW = cols.slice(0, span).reduce(function (a, b) { return a + b; }, 0);
      rows.push(K.row([
        K.cell([K.para(t.label, { align: 'right', b: true, sz: 17 })], { w: leftW, span: span, shd: t.grand ? 'ECEEF6' : 'F6F7FB' }),
        K.cell([K.para(t.value, { align: 'right', b: true, sz: t.grand ? 19 : 17 })], { w: cols[cols.length - 1], shd: t.grand ? 'ECEEF6' : 'F6F7FB' })
      ]));
    });

    d.add(K.table(rows, cols));
    d.p('', { sz: 6, after: 50 });
  }

  function docxSignFoot(d, S, spec) {
    d.p('', { sz: 8, after: 70 });
    var W = d.contentWidth, lw = Math.round(W * 0.42), rw = W - lw;

    var payRuns = [];
    if (S.chequeNote) payRuns.push(K.para(S.chequeNote, { b: true, sz: 13 }));
    var bank = [];
    if (S.bankName) bank.push(S.bankName);
    if (S.bankAcct) bank.push('A/c ' + S.bankAcct);
    if (S.bankIfsc) bank.push('IFSC ' + S.bankIfsc);
    if (bank.length) payRuns.push(K.para(bank.join('  |  '), { sz: 13 }));
    if (S.bankUpi) payRuns.push(K.para('UPI ' + S.bankUpi, { sz: 13 }));
    if (S.pan) payRuns.push(K.para('PAN ' + S.pan, { sz: 13 }));
    if (!payRuns.length) payRuns.push(K.para('', { sz: 13 }));

    var rightParas = [];
    if (S.showSign) {
      var wmm = S.paper === 'A4' ? 56 : 46;
      var hmm = wmm * (ASSETS.signBlockWH[1] / ASSETS.signBlockWH[0]);
      var runs = [];
      if (S.showSeal) {
        var sw = S.paper === 'A4' ? 22 : 18, sh = sw * (ASSETS.sealWH[1] / ASSETS.sealWH[0]);
        runs.push(d.imageRun(ASSETS.seal, sw, sh));
        runs.push(K.run('  '));
      }
      runs.push(d.imageRun(ASSETS.signBlock, wmm, hmm));
      rightParas.push(K.para(runs, { align: 'right' }));
    } else {
      if (S.showSeal) {
        var sw2 = 22, sh2 = sw2 * (ASSETS.sealWH[1] / ASSETS.sealWH[0]);
        rightParas.push(K.para([d.imageRun(ASSETS.seal, sw2, sh2)], { align: 'right' }));
      } else {
        rightParas.push(K.para('', { sz: 20, after: 300 }));
      }
      rightParas.push(K.para(S.name, { align: 'right', b: true, sz: 17, topBorder: { sz: 4, color: '333333' } }));
      rightParas.push(K.para(S.designation || 'Advocate', { align: 'right', sz: 15 }));
    }

    d.add(K.table([
      K.row([
        K.cell(payRuns, { w: lw, noBorder: true, vAlign: 'bottom', padH: 0 }),
        K.cell(rightParas, { w: rw, noBorder: true, vAlign: 'bottom', padH: 0 })
      ])
    ], [lw, rw], { borders: false }));
  }

  function renderDocx(spec, S) {
    var a4 = S.paper === 'A4';
    var d = K.createDoc({
      pageW: a4 ? 210 : 148, pageH: a4 ? 297 : 210,
      marginTop: a4 ? 14 : 10, marginBottom: a4 ? 12 : 9,
      marginLeft: a4 ? 16 : 11, marginRight: a4 ? 16 : 11,
      font: 'Times New Roman', size: a4 ? 22 : 20
    });

    docxLetterhead(d, S);
    docxTitle(d, spec);
    docxMeta(d, spec);
    docxTo(d, spec);

    if (spec.matter)
      d.p([K.run((spec.matterLabel || 'Matter') + ': ', { b: true, sz: 18 }), K.run(spec.matter, { sz: 18 })],
        { leftBorder: { sz: 18, color: INK, space: 4 }, shd: 'F7F8FC', after: 80, before: 20, ind: { left: 60 } });

    if (spec.intro) d.p(spec.intro, { sz: 18, align: 'both', after: 70 });

    if (spec.kind === 'receipt') {
      var r = spec.receipt;
      d.p([K.run('Received with thanks from ', { sz: 19 }), K.run(spec.to.name, { sz: 19, b: true, u: true })], { after: 70 });
      d.p([K.run('the sum of ', { sz: 19 }), K.run(r.words, { sz: 19, b: true, u: true })], { after: 70 });
      d.p([K.run('by ', { sz: 19 }), K.run(r.mode, { sz: 19, b: true, u: true }),
      K.run(r.ref ? ' vide ' : '', { sz: 19 }), K.run(r.ref || '', { sz: 19, b: true, u: true })], { after: 70 });
      if (r.against) d.p([K.run('towards ', { sz: 19 }), K.run(r.against, { sz: 19, b: true, u: true })], { after: 120 });

      var W = d.contentWidth, bw = Math.round(W * 0.38);
      d.add(K.table([K.row([
        K.cell([K.para(r.amount, { align: 'center', b: true, sz: 28, color: INK })], { w: bw, padV: 60 }),
        K.cell([K.para(r.balanceLine || '', { sz: 17 })], { w: W - bw, noBorder: true, padH: 120 })
      ])], [bw, W - bw], { borders: { color: INK, sz: 8 } }));
      d.p('', { sz: 6, after: 90 });
    } else {
      docxTable(d, spec);
      if (spec.words) {
        d.add(K.table([K.row([K.cell(
          [K.para([K.run('Amount in words: ', { b: true, sz: 17 }), K.run(spec.words, { sz: 17 })])],
          { w: d.contentWidth, shd: 'FAFBFF', padV: 34 })])], [d.contentWidth]));
        d.p('', { sz: 6, after: 50 });
      }
    }

    (spec.blocks || []).forEach(function (b) {
      if (!b.text) return;
      d.p(b.hd, { b: true, caps: true, sz: 14, color: INK, spacing: 20, before: 40, after: 20 });
      d.p(b.text, { sz: 15, after: 40 });
    });

    docxSignFoot(d, S, spec);
    if (spec.footNote) {
      d.p('', { sz: 4, topBorder: { sz: 4, color: 'C9CDE0' }, before: 50, after: 20 });
      d.p(spec.footNote, { sz: 12, color: '666666' });
    }
    return d.blob();
  }

  global.DocRender = { html: renderHTML, docx: renderDocx };
})(window);
