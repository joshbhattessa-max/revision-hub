// A small PDF writer for the deployment records (/deploys/…/N.pdf): A4 pages of wrapped text in the standard Helvetica
// and Courier fonts, filled boxes, rules and clickable links. No fonts are embedded (every PDF reader has these), so a
// record is a few kilobytes and is made fresh each time it's opened. Text is Windows-1252 (WinAnsiEncoding); anything
// outside it is swapped for something close, or "?".

// character widths (1/1000 of the font size) of Helvetica and Helvetica-Bold for codes 32-255; Courier is all 600
const WIDTHS = {
  H: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  B: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
};

const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
const SWAP = { '→': '->', '←': '<-', '↔': '<->', '≥': '>=', '≤': '<=', '≠': '!=', '✓': 'Yes', '✔': 'Yes', '✗': 'x', '−': '-',
  '‑': '-', '‐': '-', ' ': ' ', ' ': ' ', ' ': ' ', '\t': '    ' };

export const PAGE = { w: 595.28, h: 841.89, left: 50, right: 50, top: 56, bottom: 64 };
const FONTS = { H: 'Helvetica', B: 'Helvetica-Bold', C: 'Courier' };

// the text as Windows-1252 codes
function codes(s) {
  const out = [];
  for (let ch of String(s)) {
    if (SWAP[ch] !== undefined) { for (const c of SWAP[ch]) out.push(c.charCodeAt(0)); continue; }
    let c = ch.codePointAt(0);
    if (c >= 32 && c < 127) { out.push(c); continue; }
    if (c >= 160 && c <= 255) { out.push(c); continue; }
    if (CP1252[ch]) { out.push(CP1252[ch]); continue; }
    if (c < 32) continue;
    // é, ő, ł... without their accents, then anything else as "?"
    const plain = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    if (plain && plain.codePointAt(0) < 127 && plain.codePointAt(0) >= 32) out.push(...[...plain].map(x => x.charCodeAt(0)));
    else if (!/\p{Extended_Pictographic}|️|‍/u.test(ch)) out.push(63);
  }
  return out;
}
const widthOf = (cs, font, size) => cs.reduce((t, c) => t + (font === 'C' ? 600 : WIDTHS[font][c - 32] || 556), 0) * size / 1000;
export const textWidth = (s, font = 'H', size = 10) => widthOf(codes(s), font, size);
const pdfString = cs => '(' + cs.map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c)
  : c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('') + ')';
const num = n => (Math.round(n * 100) / 100).toString();
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#000000');
  const v = m ? parseInt(m[1], 16) : 0;
  return [v >> 16 & 255, v >> 8 & 255, v & 255].map(x => num(x / 255)).join(' ');
}

// lines of at most `width` points: by words, and long words (paths, links) by characters
export function wrap(s, font, size, width) {
  const lines = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(/(?<= )/)) {
      if (textWidth(line + word, font, size) <= width) { line += word; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      let w = word;
      while (textWidth(w.trimEnd(), font, size) > width) {
        let n = 1;
        while (n < w.length && textWidth(w.slice(0, n + 1), font, size) <= width) n++;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export class Pdf {
  constructor(info = {}) {
    this.info = info;
    this.pages = [];
    this.newPage();
  }
  get width() { return PAGE.w - PAGE.left - PAGE.right; }
  newPage() {
    this.page = { ops: [], links: [] };
    this.pages.push(this.page);
    this.y = PAGE.h - PAGE.top;
    if (this.onPage) this.onPage(this);
  }
  // room for h points more on this page, or start the next one
  need(h) { if (this.y - h < PAGE.bottom) this.newPage(); }
  box(x, y, w, h, color) { this.page.ops.push(`${rgb(color)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`); }
  rule(color = '#e4e2dd', weight = 0.75) {
    this.page.ops.push(`${rgb(color)} RG ${num(weight)} w ${PAGE.left} ${num(this.y)} m ${num(PAGE.w - PAGE.right)} ${num(this.y)} l S`);
  }
  // one line of text with its baseline at y
  at(x, y, s, { font = 'H', size = 10, color = '#33312e', link } = {}) {
    const cs = codes(s);
    this.page.ops.push(`BT /F${font} ${num(size)} Tf ${rgb(color)} rg ${num(x)} ${num(y)} Td ${pdfString(cs)} Tj ET`);
    if (link) this.page.links.push({ rect: [x, y - size * 0.25, x + widthOf(cs, font, size), y + size * 0.85], url: link });
    return widthOf(cs, font, size);
  }
  // a wrapped paragraph from the current position down
  text(s, { font = 'H', size = 10, color = '#33312e', indent = 0, lead = 1.38, after = 0, link, width } = {}) {
    const lh = size * lead;
    for (const line of wrap(s, font, size, (width || this.width) - indent)) {
      this.need(lh);
      this.y -= lh;
      this.at(PAGE.left + indent, this.y + (lh - size) / 2 + size * 0.18, line, { font, size, color, link });
    }
    this.y -= after;
  }
  gap(h) { this.y -= h; }
  // the file, with "Page n of N" (or whatever footer() draws) on every page
  bytes(footer) {
    if (footer) this.pages.forEach((p, i) => { const keep = this.page; this.page = p; footer(this, i + 1, this.pages.length); this.page = keep; });
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pages = add(null);
    const fonts = Object.entries(FONTS).map(([k, name]) =>
      [k, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name}${k === 'C' ? '' : ' /Encoding /WinAnsiEncoding'} >>`)]);
    const res = '<< /Font << ' + fonts.map(([k, n]) => `/F${k} ${n} 0 R`).join(' ') + ' >> >>';
    const kids = [];
    for (const p of this.pages) {
      const content = p.ops.join('\n');
      const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const annots = p.links.map(l => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(num).join(' ')}] /Border [0 0 0] ` +
        `/A << /S /URI /URI ${pdfString(codes(l.url))} >> >>`));
      kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources ${res} /Contents ${stream} 0 R` +
        (annots.length ? ` /Annots [${annots.map(a => a + ' 0 R').join(' ')}]` : '') + ' >>'));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
    objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const info = add(`<< /Title ${pdfString(codes(this.info.title || ''))} /Author ${pdfString(codes(this.info.author || ''))} /Producer (JB Revision) >>`);
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(out);
  }
}
