/* Ramz - minimal styled XLSX writer (no library): fills, fonts, borders, merges, formulas with cached
   values, column widths, freeze panes, landscape fit-to-width. Zip is written uncompressed (stored). */
(function () {
  'use strict';
  var enc = new TextEncoder();
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  var CRC = (function () { var t = [], n, c, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF, i; for (i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function ref(r, c) { return colName(c) + (r + 1); }

  /* styles: descriptor {b, i, sz, color, bg, border, h, v, wrap, nf} -> xf index */
  function Styles() { this.fonts = ['<font><sz val="11"/><name val="Calibri"/></font>']; this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']; this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>']; this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']; this.map = {}; this.nfs = []; }
  Styles.prototype.idx = function (list, xml) { var i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
  Styles.prototype.get = function (d) {
    if (!d) return 0;
    var key = JSON.stringify(d); if (this.map[key] !== undefined) return this.map[key];
    var font = '<font>' + (d.b ? '<b/>' : '') + (d.i ? '<i/>' : '') + '<sz val="' + (d.sz || 11) + '"/>' + (d.color ? '<color rgb="FF' + d.color + '"/>' : '') + '<name val="Calibri"/></font>';
    var fill = d.bg ? '<fill><patternFill patternType="solid"><fgColor rgb="FF' + d.bg + '"/><bgColor indexed="64"/></patternFill></fill>' : null;
    var bd = d.border ? '<border><left style="thin"><color rgb="FF9AA5B1"/></left><right style="thin"><color rgb="FF9AA5B1"/></right><top style="thin"><color rgb="FF9AA5B1"/></top><bottom style="thin"><color rgb="FF9AA5B1"/></bottom><diagonal/></border>' : null;
    var nf = d.nf === '2dp' ? 4 : d.nf === 'df' ? 2 : 0; if (d.fmt) { var fi = this.nfs.indexOf(d.fmt); if (fi < 0) { this.nfs.push(d.fmt); fi = this.nfs.length - 1; } nf = 164 + fi; }
    var x = '<xf numFmtId="' + nf + '" fontId="' + this.idx(this.fonts, font) + '" fillId="' + (fill ? this.idx(this.fills, fill) : 0) + '" borderId="' + (bd ? this.idx(this.borders, bd) : 0) + '" xfId="0" applyFont="1"' + (fill ? ' applyFill="1"' : '') + (bd ? ' applyBorder="1"' : '') + (nf ? ' applyNumberFormat="1"' : '') + ' applyAlignment="1"><alignment horizontal="' + (d.h || 'general') + '" vertical="' + (d.v || 'center') + '"' + (d.wrap ? ' wrapText="1"' : '') + '/></xf>';
    this.xfs.push(x); this.map[key] = this.xfs.length - 1; return this.map[key];
  };
  Styles.prototype.xml = function () {
    function wrap(tag, a) { return '<' + tag + ' count="' + a.length + '">' + a.join('') + '</' + tag + '>'; }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + (this.nfs.length ? '<numFmts count="' + this.nfs.length + '">' + this.nfs.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join('') + '</numFmts>' : '') + wrap('fonts', this.fonts) + wrap('fills', this.fills) + wrap('borders', this.borders) + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' + wrap('cellXfs', this.xfs) + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* cell: string | number | {v, f, s (style descriptor)} ; null = empty (may still carry style via {s}) */
  function sheetXml(sh, st) {
    var rows = sh.rows || [], x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    x += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    x += '<sheetViews><sheetView workbookViewId="0" showGridLines="0">' + (sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>';
    if (sh.cols) x += '<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach(function (row, r) {
      if (!row) return;
      var h = (sh.heights && sh.heights[r]) ? ' ht="' + sh.heights[r] + '" customHeight="1"' : '';
      x += '<row r="' + (r + 1) + '"' + h + '>';
      row.forEach(function (c, ci) {
        if (c === null || c === undefined) return;
        if (typeof c !== 'object') c = { v: c };
        var s = st.get(c.s), a = ref(r, ci);
        if (c.f) x += '<c r="' + a + '" s="' + s + '"' + (typeof c.v === 'number' ? '' : ' t="str"') + '><f>' + esc(c.f) + '</f>' + (c.v !== undefined ? '<v>' + esc(c.v) + '</v>' : '') + '</c>';
        else if (typeof c.v === 'number') x += '<c r="' + a + '" s="' + s + '"><v>' + c.v + '</v></c>';
        else if (c.v === undefined || c.v === '') x += '<c r="' + a + '" s="' + s + '"/>';
        else x += '<c r="' + a + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if ((sh.merges || []).length) x += '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="' + (sh.portrait ? 'portrait' : 'landscape') + '" fitToWidth="1" fitToHeight="0"/></worksheet>';
    return x;
  }
  function zip(files) {
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var lh = new Uint8Array(30 + name.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      lh.set(name, 30); parts.push(lh, data);
      var ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true);
      ch.set(name, 46); central.push(ch); off += lh.length + data.length;
    });
    var cs = 0; central.forEach(function (c) { cs += c.length; });
    var end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
    return new Blob(parts.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function build(book) {
    var st = new Styles(), sheets = book.sheets, files = [];
    var sx = sheets.map(function (s) { return sheetXml(s, st); });
    files.push({ name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', text: st.xml() });
    sx.forEach(function (t, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: t }); });
    return zip(files);
  }
  function download(book, name) {
    var blob = build(book), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return name;
  }
  window.EngXlsx = { build: build, download: download, ref: ref, colName: colName, crc32: crc32 };
})();
