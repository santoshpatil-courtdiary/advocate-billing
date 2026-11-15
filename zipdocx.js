/* ============================================================
   zipdocx.js — dependency-free ZIP writer + Word (.docx) builder
   Produces a real OOXML .docx package in the browser. No CDN,
   no libraries, works offline.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- CRC32 + ZIP (store method) ---------------- */
  var CRC = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  var ENC = new TextEncoder();
  function bytes(s) { return ENC.encode(s); }

  function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2 | 0)) & 0xFFFF; }
  function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF; }

  /** files: [{name:string, data:Uint8Array}] -> Blob */
  function zipBlob(files, mime) {
    var now = new Date(), parts = [], central = [], offset = 0;

    files.forEach(function (f) {
      var nb = bytes(f.name), crc = crc32(f.data), size = f.data.length;

      var lh = new Uint8Array(30 + nb.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);              // version needed
      dv.setUint16(6, 0, true);               // flags
      dv.setUint16(8, 0, true);               // method = store
      dv.setUint16(10, dosTime(now), true);
      dv.setUint16(12, dosDate(now), true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nb.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nb, 30);
      parts.push(lh, f.data);

      var ch = new Uint8Array(46 + nb.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);              // version made by
      cv.setUint16(6, 20, true);              // version needed
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime(now), true);
      cv.setUint16(14, dosDate(now), true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nb, 46);
      central.push(ch);

      offset += lh.length + size;
    });

    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var eocd = new Uint8Array(22), ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(parts.concat(central, [eocd]), { type: mime || 'application/zip' });
  }

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function mm2tw(mm) { return Math.round(mm * 56.6929); }   // twips
  function mm2emu(mm) { return Math.round(mm * 36000); }    // EMU
  function dataUriToBytes(uri) {
    var b64 = uri.substring(uri.indexOf(',') + 1), bin = atob(b64),
      out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ---------------- run / paragraph / table builders ---------------- */
  // opts: b(old) i(talic) u(nderline) sz(half-points) color caps spacing(letter-spacing twips) font
  function run(text, o) {
    o = o || {};
    // element order follows the CT_RPr schema sequence
    var rpr = '';
    if (o.font) rpr += '<w:rFonts w:ascii="' + esc(o.font) + '" w:hAnsi="' + esc(o.font) + '" w:cs="' + esc(o.font) + '"/>';
    if (o.b) rpr += '<w:b/><w:bCs/>';
    if (o.i) rpr += '<w:i/><w:iCs/>';
    if (o.caps) rpr += '<w:caps/>';
    if (o.color) rpr += '<w:color w:val="' + o.color + '"/>';
    if (o.spacing) rpr += '<w:spacing w:val="' + o.spacing + '"/>';
    if (o.sz) rpr += '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>';
    if (o.u) rpr += '<w:u w:val="single"/>';
    if (o.shd) rpr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    var body = String(text == null ? '' : text).split('\n').map(function (ln, i) {
      return (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(ln) + '</w:t>';
    }).join('');
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + body + '</w:r>';
  }

  // content: string (plain) or array of run-xml strings
  // opts: align, before, after, line, bottomBorder{sz,color,space}, topBorder, shd, ind, keepNext, plus run opts
  function para(content, o) {
    o = o || {};
    var runs = Array.isArray(content)
      ? content.join('')
      : run(content, o);
    // element order follows the CT_PPr schema sequence
    var ppr = '';
    if (o.keepNext) ppr += '<w:keepNext/>';
    var bdr = '';
    if (o.topBorder) bdr += '<w:top w:val="single" w:sz="' + (o.topBorder.sz || 8) + '" w:space="' + (o.topBorder.space || 1) + '" w:color="' + (o.topBorder.color || '1A237E') + '"/>';
    if (o.leftBorder) bdr += '<w:left w:val="single" w:sz="' + (o.leftBorder.sz || 18) + '" w:space="' + (o.leftBorder.space || 4) + '" w:color="' + (o.leftBorder.color || '1A237E') + '"/>';
    if (o.bottomBorder) bdr += '<w:bottom w:val="single" w:sz="' + (o.bottomBorder.sz || 8) + '" w:space="' + (o.bottomBorder.space || 1) + '" w:color="' + (o.bottomBorder.color || '1A237E') + '"/>';
    if (bdr) ppr += '<w:pBdr>' + bdr + '</w:pBdr>';
    if (o.shd) ppr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    if (o.tabRight) ppr += '<w:tabs><w:tab w:val="right" w:pos="' + o.tabRight + '"/></w:tabs>';
    if (o.before || o.after || o.line)
      ppr += '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '"' +
        (o.line ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    if (o.ind) ppr += '<w:ind w:left="' + (o.ind.left || 0) + '" w:right="' + (o.ind.right || 0) + '"/>';
    if (o.align) ppr += '<w:jc w:val="' + o.align + '"/>';
    return '<w:p>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + runs + '</w:p>';
  }

  function cell(paras, o) {
    o = o || {};
    // element order follows the CT_TcPr schema sequence
    var tcpr = '<w:tcW w:w="' + (o.w || 0) + '" w:type="dxa"/>';
    if (o.span) tcpr += '<w:gridSpan w:val="' + o.span + '"/>';
    if (o.noBorder) tcpr += '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>';
    if (o.shd) tcpr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    tcpr += '<w:tcMar><w:top w:w="' + (o.padV != null ? o.padV : 30) + '" w:type="dxa"/><w:left w:w="' + (o.padH != null ? o.padH : 70) + '" w:type="dxa"/><w:bottom w:w="' + (o.padV != null ? o.padV : 30) + '" w:type="dxa"/><w:right w:w="' + (o.padH != null ? o.padH : 70) + '" w:type="dxa"/></w:tcMar>';
    tcpr += '<w:vAlign w:val="' + (o.vAlign || 'center') + '"/>';
    return '<w:tc><w:tcPr>' + tcpr + '</w:tcPr>' + (Array.isArray(paras) ? paras.join('') : paras) + '</w:tc>';
  }

  function row(cells, o) {
    o = o || {};
    return '<w:tr>' + (o.header ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '') + cells.join('') + '</w:tr>';
  }

  // cols: array of twip widths; borders: false | {color,sz}
  function table(rows, cols, o) {
    o = o || {};
    var b = o.borders === false ? null : (o.borders || { color: '8C93B8', sz: 6 });
    // element order follows the CT_TblPr schema sequence
    var tblPr = '<w:tblW w:w="' + cols.reduce(function (a, c) { return a + c; }, 0) + '" w:type="dxa"/>';
    if (b) {
      var bb = '<w:' + '%s' + ' w:val="single" w:sz="' + b.sz + '" w:space="0" w:color="' + b.color + '"/>';
      tblPr += '<w:tblBorders>' +
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (k) { return bb.replace('%s', k); }).join('') +
        '</w:tblBorders>';
    } else {
      tblPr += '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map(function (k) { return '<w:' + k + ' w:val="nil"/>'; }).join('') + '</w:tblBorders>';
    }
    tblPr += '<w:tblLayout w:type="fixed"/>';
    tblPr += '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>';
    return '<w:tbl><w:tblPr>' + tblPr + '</w:tblPr><w:tblGrid>' +
      cols.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') +
      '</w:tblGrid>' + rows.join('') + '</w:tbl>';
  }

  /* ---------------- document builder ---------------- */
  function createDoc(opts) {
    opts = opts || {};
    var pageW = opts.pageW || 148, pageH = opts.pageH || 210;
    var mT = opts.marginTop != null ? opts.marginTop : 10,
      mR = opts.marginRight != null ? opts.marginRight : 11,
      mB = opts.marginBottom != null ? opts.marginBottom : 9,
      mL = opts.marginLeft != null ? opts.marginLeft : 11;
    var font = opts.font || 'Times New Roman';
    var baseSz = opts.size || 20;

    var body = [], images = [], imgId = 0;

    var api = {
      contentWidth: mm2tw(pageW - mL - mR),

      add: function (xml) { body.push(xml); return api; },
      p: function (content, o) { body.push(para(content, o)); return api; },
      spacer: function (tw) { body.push(para('', { sz: 2, after: tw || 0 })); return api; },

      /** dataUri PNG -> inline image paragraph */
      image: function (dataUri, widthMM, heightMM, o) {
        o = o || {};
        var id = images.length + 1;
        images.push({ name: 'image' + id + '.png', data: dataUriToBytes(dataUri) });
        imgId++;
        var cx = mm2emu(widthMM), cy = mm2emu(heightMM);
        var xml = '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
          '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
          '<wp:docPr id="' + imgId + '" name="Picture ' + imgId + '"/>' +
          '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
          '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
          '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          '<pic:nvPicPr><pic:cNvPr id="' + imgId + '" name="image' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
          '<pic:blipFill><a:blip r:embed="rIdImg' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
          '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
          '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
          '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
        if (o.inlineOnly) return xml;
        body.push(para([xml], { align: o.align || 'right', after: o.after || 0, before: o.before || 0 }));
        return api;
      },

      imageRun: function (dataUri, widthMM, heightMM) {
        return api.image(dataUri, widthMM, heightMM, { inlineOnly: true });
      },

      blob: function () {
        var sectPr = '<w:sectPr>' +
          '<w:pgSz w:w="' + mm2tw(pageW) + '" w:h="' + mm2tw(pageH) + '" w:orient="portrait"/>' +
          '<w:pgMar w:top="' + mm2tw(mT) + '" w:right="' + mm2tw(mR) + '" w:bottom="' + mm2tw(mB) +
          '" w:left="' + mm2tw(mL) + '" w:header="0" w:footer="0" w:gutter="0"/>' +
          '</w:sectPr>';

        var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
          'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
          'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
          'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          '<w:body>' + body.join('') + sectPr + '</w:body></w:document>';

        var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:docDefaults><w:rPrDefault><w:rPr>' +
          '<w:rFonts w:ascii="' + esc(font) + '" w:hAnsi="' + esc(font) + '" w:cs="' + esc(font) + '"/>' +
          '<w:sz w:val="' + baseSz + '"/><w:szCs w:val="' + baseSz + '"/></w:rPr></w:rPrDefault>' +
          '<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
          '</w:docDefaults>' +
          '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
          '</w:styles>';

        var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          images.map(function (im, i) {
            return '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + im.name + '"/>';
          }).join('') + '</Relationships>';

        var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Default Extension="png" ContentType="image/png"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '</Types>';

        var pkgRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>';

        var files = [
          { name: '[Content_Types].xml', data: bytes(ct) },
          { name: '_rels/.rels', data: bytes(pkgRels) },
          { name: 'word/document.xml', data: bytes(doc) },
          { name: 'word/styles.xml', data: bytes(styles) },
          { name: 'word/_rels/document.xml.rels', data: bytes(rels) }
        ];
        images.forEach(function (im) { files.push({ name: 'word/media/' + im.name, data: im.data }); });

        return zipBlob(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }
    };
    return api;
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  global.DocxKit = {
    createDoc: createDoc, run: run, para: para, cell: cell, row: row, table: table,
    mm2tw: mm2tw, esc: esc, saveBlob: saveBlob, zipBlob: zipBlob
  };
})(window);
